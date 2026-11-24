import type { Response } from 'express';
import { Types } from 'mongoose';
import Conversation from '../models/conversation.model';
import Message from '../models/message.model';
import User from '../models/user.model';
import { identity, type AuthRequest } from '../middlewares/authMiddleware';
import { duplicateKey, HttpError, objectId, textField } from '../http';
import { publishMessage } from '../utils/socket';
import { generateSmartReplies, summarizeConversation } from '../utils/gemini';

const messageFields = '_id conversationId senderId content isRead createdAt';
const publicPerson = '_id name username';
const threadFields = '_id title isGroup participants lastMessage createdAt updatedAt';
const pageSize = 50;

function populatedThread(conversationId: Types.ObjectId) {
    return Conversation.findById(conversationId).select(threadFields)
        .populate('participants', publicPerson).populate('lastMessage', messageFields);
}

async function requireConversation(id: Types.ObjectId, userId: string) {
    const conversation = await Conversation.findOne({ _id: id, participants: userId }).select('participants').lean();
    if (!conversation) throw new HttpError(404, 'Conversation not found');
    return conversation;
}

export async function getConversations(req: AuthRequest, res: Response) {
    const userId = identity(req).userId;
    const conversations = await Conversation.find({ participants: userId })
        .select(`${threadFields} latestIncoming readThrough`)
        .populate('participants', publicPerson).populate('lastMessage', messageFields).sort({ updatedAt: -1, _id: -1 }).lean();
    res.json(conversations.map(({ latestIncoming, readThrough, ...conversation }) => {
        const incoming = latestIncoming?.[userId]?.toString();
        const read = readThrough?.[userId]?.toString();
        return { ...conversation, unreadMessageId: incoming && (!read || incoming > read) ? incoming : null };
    }));
}

export async function getMessages(req: AuthRequest, res: Response) {
    const conversationId = objectId(req.params.conversationId, 'conversation');
    const { before, after } = req.query;
    if (before !== undefined && after !== undefined) throw new HttpError(400, 'Use one message cursor');
    const cursorRange = before !== undefined ? { $lt: objectId(before, 'cursor') }
        : after !== undefined ? { $gt: objectId(after, 'cursor') } : undefined;
    await requireConversation(conversationId, identity(req).userId);

    const rows = await Message.find({ conversationId, ...(cursorRange && { _id: cursorRange }) })
        .select(messageFields).sort({ _id: after !== undefined ? 1 : -1 }).limit(pageSize + 1).lean();
    const messages = rows.slice(0, pageSize);
    const nextCursor = rows.length > pageSize ? messages.at(-1)!._id.toString() : null;
    if (after === undefined) messages.reverse();
    res.json({ messages, nextCursor });
}

export async function sendMessage(req: AuthRequest, res: Response) {
    const userId = identity(req).userId;
    const conversationId = objectId(req.body?.conversationId, 'conversation');
    const content = textField(req.body?.content, 4000);
    const clientMessageId = req.body?.clientMessageId;
    if (!content || typeof clientMessageId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(clientMessageId)) {
        throw new HttpError(400, 'Provide a message of up to 4000 characters and a valid message ID');
    }
    const conversation = await requireConversation(conversationId, userId);
    const key = { conversationId, senderId: new Types.ObjectId(userId), clientMessageId };
    let created = true;

    const message = await Message.create({ ...key, content }).catch(async (error: unknown) => {
        if (!duplicateKey(error)) throw error;
        created = false;
        const existing = await Message.findOne(key);
        if (!existing) throw error;
        if (existing.content !== content) throw new HttpError(409, 'This message ID was already used');
        return existing;
    });

    const participants = conversation.participants.map(String);
    const incoming = Object.fromEntries(participants.filter(id => id !== userId).map(id => {
        const field = `latestIncoming.${id}`;
        return [field, { $max: [`$${field}`, message._id] }];
    }));
    await Conversation.updateOne({ _id: conversationId }, [{
        $set: {
            lastMessage: { $max: ['$lastMessage', message._id] },
            updatedAt: { $cond: [{ $lt: ['$lastMessage', message._id] }, message.createdAt, '$updatedAt'] },
            ...incoming,
        },
    }], { timestamps: false, updatePipeline: true });

    const payload = {
        _id: message.id, conversationId: conversationId.toString(), senderId: userId,
        content: message.content, createdAt: message.createdAt, isRead: message.isRead,
    };
    publishMessage(participants, payload);
    res.status(created ? 201 : 200).json(payload);
}

export async function markConversationRead(req: AuthRequest, res: Response) {
    const userId = identity(req).userId;
    const conversationId = objectId(req.body?.conversationId, 'conversation');
    const messageId = objectId(req.body?.messageId, 'message');
    await requireConversation(conversationId, userId);
    if (!await Message.exists({ _id: messageId, conversationId, senderId: { $ne: userId } })) {
        throw new HttpError(404, 'Message not found');
    }
    await Conversation.updateOne({ _id: conversationId }, {
        $max: { [`readThrough.${userId}`]: messageId },
    }, { timestamps: false });
    res.json({ ok: true });
}

export async function createConversation(req: AuthRequest, res: Response) {
    const userId = identity(req).userId;
    const participant = objectId(req.body?.participantId, 'participant');
    if (userId === participant.toString()) throw new HttpError(400, 'Choose another person');
    if (!await User.exists({ _id: participant, isUsernameSet: true })) throw new HttpError(404, 'Person not found');

    const participants = [new Types.ObjectId(userId), participant];
    const directKey = participants.map(String).sort().join(':');
    const legacy = await Conversation.findOne({
        isGroup: false, directKey: { $exists: false }, participants: { $all: participants, $size: 2 },
    }).select('_id').lean();
    if (legacy) {
        res.json(await populatedThread(legacy._id));
        return;
    }

    const conversation = await Conversation.findOneAndUpdate({ directKey }, {
        $setOnInsert: { participants, isGroup: false, createdAt: new Date(), updatedAt: new Date() },
    }, { upsert: true, returnDocument: 'after', timestamps: false }).catch(async (error: unknown) => {
        if (!duplicateKey(error)) throw error;
        return Conversation.findOne({ directKey });
    });
    if (!conversation) throw new HttpError(503, 'Could not open the conversation. Try again');
    res.json(await populatedThread(conversation._id));
}

export async function searchUsers(req: AuthRequest, res: Response) {
    const term = textField(req.query.q, 80).replace(/^@/, '');
    if (!term) {
        res.json([]);
        return;
    }
    const escaped = term.split('').map(char => '|\\{}()[]^$+*?.'.includes(char) ? '\\' + char : char).join('');
    const matches = new RegExp(escaped, 'i');
    const users = await User.find({
        _id: { $ne: identity(req).userId }, isUsernameSet: true,
        $or: [{ username: matches }, { name: matches }],
    }).select(publicPerson).sort({ username: 1 }).limit(20).lean();
    res.json(users);
}

export async function getAllUsers(req: AuthRequest, res: Response) {
    const users = await User.find({ _id: { $ne: identity(req).userId }, isUsernameSet: true })
        .select(publicPerson).sort({ username: 1 }).limit(20).lean();
    res.json(users);
}

export async function getSmartReplies(req: AuthRequest, res: Response) {
    const userId = identity(req).userId;
    const conversationId = objectId(req.body?.conversationId, 'conversation');
    const messageId = objectId(req.body?.messageId, 'message');
    await requireConversation(conversationId, userId);
    const message = await Message.findOne({ _id: messageId, conversationId, senderId: { $ne: userId } }).select('content').lean();
    if (!message) throw new HttpError(404, 'Message not found');
    res.json({ replies: await generateSmartReplies(message.content) });
}

export async function getConversationSummary(req: AuthRequest, res: Response) {
    const conversationId = objectId(req.params.conversationId, 'conversation');
    const conversation = await requireConversation(conversationId, identity(req).userId);
    const messages = await Message.find({ conversationId }).select('senderId content').sort({ _id: -1 }).limit(40).lean();
    if (!messages.length) {
        res.json({ summary: 'No messages to summarize.' });
        return;
    }

    const people = await User.find({ _id: { $in: conversation.participants } }).select('name').lean();
    const names = new Map(people.map(({ _id, name }) => [_id.toString(), name]));
    const transcript = messages.reverse().map(({ senderId, content }) =>
        ({ sender: names.get(senderId.toString()) || 'Participant', content: content.slice(0, 500) }));
    res.json({ summary: await summarizeConversation(transcript) });
}
