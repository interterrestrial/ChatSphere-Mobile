import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { resolveIdentity, type Identity } from './authUtils';

const userRoom = (id: string) => `user:${id}`;
const sessionRoom = (id: string) => `session:${id}`;

let io: Server | undefined;

export function initializeSocket(server: HttpServer, origins: string[]) {
    const live = new Server(server, {
        cors: { origin: origins },
        allowRequest: (request, callback) => callback(null, !request.headers.origin || origins.includes(request.headers.origin)),
        maxHttpBufferSize: 16 * 1024,
    });
    io = live;

    live.use(async (socket, next) => {
        try {
            const identity = await resolveIdentity(socket.handshake.auth.token, 'socket');
            if (!identity) return next(new Error('Authentication required'));
            socket.data.identity = identity;
            next();
        } catch {
            next(new Error('Service unavailable'));
        }
    });

    live.on('connection', async socket => {
        const identity: Identity = socket.data.identity;
        await socket.join(sessionRoom(identity.sessionId));
        try {
            const verified = await resolveIdentity(socket.handshake.auth.token, 'socket');
            if (!verified || !socket.connected) {
                socket.disconnect(true);
                return;
            }
            await socket.join(userRoom(identity.userId));
            socket.emit('ready');
        } catch {
            socket.disconnect(true);
            return;
        }
        const timer = setTimeout(() => socket.disconnect(true), Math.max(0, identity.expiresAt.getTime() - Date.now()));
        timer.unref();
        socket.once('disconnect', () => clearTimeout(timer));
    });

    return live;
}

export function publishMessage(participants: string[], message: object) {
    if (participants.length) io?.to(participants.map(userRoom)).emit('newMessage', message);
}

export function disconnectSession(id: string) {
    io?.in(sessionRoom(id)).disconnectSockets(true);
}
