import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import mongoose from 'mongoose';
import { io as client, type Socket } from 'socket.io-client';
import { createApp } from '../app';
import { connectDB } from '../db/db';
import { initializeSocket } from '../utils/socket';
import Message from '../models/message.model';
import PushDevice from '../models/pushDevice.model';
import { deliverMessagePush } from '../utils/deliverMessagePush';
import { RetryablePushError } from '../utils/firebasePush';

type Json = {
    token: string; user: { _id: string; username: string }; _id: string;
    messages: { _id: string; content: string }[]; nextCursor: string | null;
};

const webOrigin = 'https://chatsphere.example.test';
let base: string;
let sockets: ReturnType<typeof initializeSocket>;
const subscribers = new Set<Socket>();

before(async () => {
    const uri = process.env.TEST_MONGO_URI;
    if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\/?$/.test(uri)) {
        throw new Error('TEST_MONGO_URI must be a localhost MongoDB URI without a database name');
    }
    process.env.JWT_SECRET = randomUUID() + randomUUID();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GOOGLE_CLIENT_IDS;
    await connectDB(`${uri.replace(/\/$/, '')}/chatsphere_test_${randomUUID().replace(/-/g, '')}`);
    const server = http.createServer(createApp({ port: 6001, trustProxy: 0, webOrigins: [webOrigin], googleClientIds: [] }));
    sockets = initializeSocket(server, [webOrigin]);
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert(address && typeof address !== 'string');
    base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
    subscribers.forEach(socket => socket.disconnect());
    await sockets?.close();
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
});

async function request(path: string, token?: string, body?: object) {
    const response = await fetch(base + path, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
            ...(body && { 'Content-Type': 'application/json' }),
            Origin: webOrigin,
        },
        body: body && JSON.stringify(body),
    });
    return { status: response.status, headers: response.headers, json: await response.json().catch(() => null) as Json };
}

async function register(username: string) {
    const response = await request('/api/auth/register', undefined, {
        name: username, email: `${username}@example.test`, password: 'long-test-password', username,
    });
    assert.equal(response.status, 201);
    return response.json;
}

function event<T>(socket: Socket, name: string) {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), 2500);
        socket.once(name, (value: T) => {
            clearTimeout(timer);
            resolve(value);
        });
    });
}

async function openSocket(token: string) {
    const socket = client(base, { auth: { token }, autoConnect: false, reconnection: false });
    subscribers.add(socket);
    const ready = event(socket, 'ready');
    socket.connect();
    await ready;
    return socket;
}

test('validates credentials, keeps profile data private, and limits access to the correct token scope', async () => {
    const health = await request('/health/ready');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('access-control-allow-origin'), webOrigin);
    assert.equal((await request('/api/auth/register', undefined, { email: {}, password: 'short' })).status, 400);
    const user = await register('first_user');
    assert.equal((await request('/api/auth/login', undefined, { identifier: 'first_user', password: 'bad-password' })).status, 401);
    const login = await request('/api/auth/login', undefined, { identifier: 'FIRST_USER', password: 'long-test-password' });
    assert.equal(login.status, 200);
    assert.equal(login.json.user._id, user.user._id);
    assert(!('password' in login.json.user));
    assert.equal(login.headers.get('cache-control'), 'no-store');

    assert.equal((await request('/api/auth/choose-username', user.token, { username: 'revised_name' })).status, 200);
    assert.equal((await request('/api/auth/session', user.token)).json.user.username, 'revised_name');
    const ticket = await request('/api/auth/socket-ticket', user.token);
    assert.equal(ticket.status, 200);
    assert.equal((await request('/api/auth/session', ticket.json.token)).status, 401);

    const invalidSocket = client(base, { auth: { token: user.token }, autoConnect: false, reconnection: false });
    subscribers.add(invalidSocket);
    const denied = event<Error>(invalidSocket, 'connect_error');
    invalidSocket.connect();
    assert.equal((await denied).message, 'Authentication required');
});

test('restricts history and AI to members, deduplicates writes, pages history, and revokes live sessions', async () => {
    const alice = await register('alice');
    const bob = await register('bob');
    const outsider = await register('outside');
    const [first, second] = await Promise.all([
        request('/api/chat/conversations', alice.token, { participantId: bob.user._id }),
        request('/api/chat/conversations', bob.token, { participantId: alice.user._id }),
    ]);
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const conversationId = first.json._id;
    assert.equal(second.json._id, conversationId);
    const messagesPath = `/api/chat/messages/${conversationId}`;

    assert.equal((await request(messagesPath, outsider.token)).status, 404);
    assert.equal((await request(`/api/chat/summary/${conversationId}`, outsider.token)).status, 404);
    assert.equal((await request('/api/chat/messages', outsider.token, { conversationId, content: 'private', clientMessageId: randomUUID() })).status, 404);
    assert.equal((await request('/api/chat/users/search?q=%2E%2A', alice.token)).status, 200);

    const bobTicket = (await request('/api/auth/socket-ticket', bob.token)).json.token;
    const bobSocket = await openSocket(bobTicket);
    const outsiderSocket = await openSocket((await request('/api/auth/socket-ticket', outsider.token)).json.token);
    let unrelatedDeliveries = 0;
    outsiderSocket.on('newMessage', () => { unrelatedDeliveries++; });
    const delivers = event<{ _id: string }>(bobSocket, 'newMessage');
    const body = { conversationId, clientMessageId: randomUUID(), content: 'Hello from Alice' };
    const results = await Promise.all([request('/api/chat/messages', alice.token, body), request('/api/chat/messages', alice.token, body)]);
    assert.deepEqual(results.map(result => result.status).sort(), [200, 201]);
    assert.equal(results[0].json._id, results[1].json._id);
    assert.equal((await delivers)._id, results[0].json._id);
    assert.equal(unrelatedDeliveries, 0);
    assert.equal((await request('/api/chat/messages', alice.token, { ...body, content: 'changed' })).status, 409);
    assert.equal(await Message.countDocuments({ conversationId }), 1);

    const reply = { conversationId, messageId: results[0].json._id };
    assert.equal((await request('/api/chat/smart-replies', outsider.token, reply)).status, 404);
    assert.equal((await request('/api/chat/smart-replies', bob.token, reply)).status, 503);

    await Message.insertMany(Array.from({ length: 53 }, (_, i) =>
        ({ conversationId, content: `Sample ${i}`, senderId: alice.user._id })));
    const newest = await request(messagesPath, bob.token);
    assert.equal(newest.json.messages.length, 50);
    const older = await request(`${messagesPath}?before=${newest.json.nextCursor}`, bob.token);
    assert.equal(older.json.messages.length, 4);
    assert.equal(older.json.nextCursor, null);
    const later = await request(`${messagesPath}?after=${older.json.messages.at(-1)!._id}`, bob.token);
    assert.deepEqual(later.json.messages, newest.json.messages);

    const disconnected = event(bobSocket, 'disconnect');
    assert.equal((await request('/api/auth/logout', bob.token, {})).status, 204);
    await disconnected;
    assert.equal((await request(messagesPath, bob.token)).status, 401);
    assert.equal((await request(messagesPath, alice.token)).status, 200);
});

test('tracks unread messages per recipient and keeps read state across sessions and retries', async () => {
    const alice = await register('unread_alice');
    const bob = await register('unread_bob');
    const outsider = await register('unread_outside');
    const bobSecondSession = (await request('/api/auth/login', undefined, {
        identifier: 'unread_bob', password: 'long-test-password',
    })).json.token;
    const { json: { _id: conversationId } } = await request('/api/chat/conversations', alice.token, { participantId: bob.user._id });
    const { json: { _id: otherConversationId } } = await request('/api/chat/conversations', bob.token, { participantId: outsider.user._id });
    const inbox = async (token: string) => {
        const result = await request('/api/chat/conversations', token);
        assert.equal(result.status, 200);
        const conversations = result.json as unknown as { _id: string; unreadMessageId: string | null; updatedAt: string }[];
        const conversation = conversations.find(({ _id }) => _id === conversationId);
        assert(conversation);
        assert(!('readThrough' in conversation));
        assert(!('latestIncoming' in conversation));
        return conversation;
    };
    const sending = (token: string, content: string) => request('/api/chat/messages', token, {
        conversationId, clientMessageId: randomUUID(), content,
    });
    const markRead = (token: string, messageId: string) => request('/api/chat/read', token, { conversationId, messageId });

    assert.equal((await inbox(bob.token)).unreadMessageId, null);
    const body = { conversationId, clientMessageId: randomUUID(), content: 'First unread message' };
    const first = (await request('/api/chat/messages', alice.token, body)).json._id;
    assert.equal((await inbox(alice.token)).unreadMessageId, null);
    assert.equal((await inbox(bobSecondSession)).unreadMessageId, first);
    assert.equal((await request(`/api/chat/messages/${conversationId}`, bob.token)).status, 200);
    assert.equal((await inbox(bob.token)).unreadMessageId, first);
    assert.equal((await markRead(outsider.token, first)).status, 404);
    assert.equal((await request('/api/chat/read', bob.token, { conversationId: otherConversationId, messageId: first })).status, 404);

    const second = (await sending(alice.token, 'Another unread message')).json._id;
    const outgoing = (await sending(bob.token, 'A reply from Bob')).json._id;
    assert.equal((await markRead(bob.token, outgoing)).status, 404);
    assert.equal((await markRead(bob.token, first)).status, 200);
    const beforeRead = await inbox(bob.token);
    assert.equal(beforeRead.unreadMessageId, second);
    assert.equal((await markRead(bob.token, second)).status, 200);
    const afterRead = await inbox(bobSecondSession);
    assert.equal(afterRead.unreadMessageId, null);
    assert.equal(afterRead.updatedAt, beforeRead.updatedAt);
    assert.equal((await inbox(alice.token)).unreadMessageId, outgoing);

    assert.equal((await markRead(bob.token, first)).status, 200);
    assert.equal((await request('/api/chat/messages', alice.token, body)).status, 200);
    assert.equal((await inbox(bob.token)).unreadMessageId, null);
    const third = (await sending(alice.token, 'New unread after reading')).json._id;
    assert.equal((await inbox(bob.token)).unreadMessageId, third);
});

test('routes push to signed-in recipients, retries only failed devices, and removes registrations on logout', async () => {
    const sender = await register('push_sender');
    const recipient = await register('push_recipient');
    const otherSession = (await request('/api/auth/login', undefined, {
        identifier: 'push_recipient', password: 'long-test-password',
    })).json.token;
    const first = { installationId: randomUUID(), registrationToken: 'fixture:recipient-first-device' };
    const second = { installationId: randomUUID(), registrationToken: 'fixture:recipient-second-device' };
    assert.equal((await request('/api/notifications/register', undefined, first)).status, 401);
    assert.equal((await request('/api/notifications/register', recipient.token, { ...first, installationId: 'invalid' })).status, 400);
    assert.equal((await request('/api/notifications/register', recipient.token, first)).status, 204);
    assert.equal((await request('/api/notifications/register', otherSession, second)).status, 204);
    assert.equal((await request('/api/notifications/register', sender.token, {
        installationId: randomUUID(), registrationToken: 'fixture:senders-own-device',
    })).status, 204);
    assert.equal((await request('/api/notifications/unregister', sender.token, { installationId: first.installationId })).status, 204);

    const conversation = (await request('/api/chat/conversations', sender.token, { participantId: recipient.user._id })).json;
    const send = async (content: string) => {
        const result = await request('/api/chat/messages', sender.token, {
            conversationId: conversation._id, content, clientMessageId: randomUUID(),
        });
        assert.equal(result.status, 201);
        return result.json._id;
    };
    const messageId = await send('Message that should alert the recipient');
    const attempts: string[] = [];
    const transport = async (registrationToken: string, conversationId: string, id: string): Promise<'sent' | 'unregistered'> => {
        assert.equal(conversationId, conversation._id);
        assert.equal(id, messageId);
        attempts.push(registrationToken);
        if (registrationToken === second.registrationToken) {
            if (attempts.filter(token => token === registrationToken).length === 1) throw new RetryablePushError(60);
            return 'unregistered';
        }
        return 'sent';
    };
    await assert.rejects(deliverMessagePush(messageId, transport), (error: unknown) =>
        error instanceof RetryablePushError && error.retryAfter === 60);
    await deliverMessagePush(messageId, transport);
    await deliverMessagePush(messageId, transport);
    assert.deepEqual(attempts.sort(), [first.registrationToken, second.registrationToken, second.registrationToken].sort());
    assert.equal(await PushDevice.exists({ _id: second.installationId }), null);

    const readMessageId = await send('Read before push delivery');
    assert.equal((await request('/api/chat/read', recipient.token, { conversationId: conversation._id, messageId: readMessageId })).status, 200);
    await deliverMessagePush(readMessageId, async () => assert.fail('Read message should not trigger delivery'));
    assert.equal((await request('/api/auth/logout', recipient.token, {})).status, 204);
    assert.equal(await PushDevice.exists({ _id: first.installationId }), null);
    await deliverMessagePush(await send('Recipient has signed out'), async () => assert.fail('Signed-out device should receive no push'));
});
