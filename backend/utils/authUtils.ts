import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import Session from '../models/session.model';
import { jwtSecret } from '../config';

const issuer = 'chatsphere';
const sessionLifetime = 7 * 24 * 60 * 60;
export const socketTicketLifetime = 60;
type Scope = 'session' | 'socket';

export interface Identity {
    userId: string;
    sessionId: string;
    expiresAt: Date;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePasswords = (password: string, hash: string) => bcrypt.compare(password, hash);

function signToken(userId: string, sessionId: string, scope: Scope, expiresIn: number) {
    return jwt.sign({ sid: sessionId }, jwtSecret(), {
        algorithm: 'HS256',
        issuer,
        audience: scope,
        subject: userId,
        expiresIn,
    });
}

export async function createSession(userId: string) {
    const record = await Session.create({ userId, expiresAt: new Date(Date.now() + sessionLifetime * 1000) });
    return signToken(userId, record.id, 'session', sessionLifetime);
}

export function createSocketTicket(identity: Identity) {
    return signToken(identity.userId, identity.sessionId, 'socket', socketTicketLifetime);
}

export async function resolveIdentity(token: unknown, scope: Scope): Promise<Identity | null> {
    if (typeof token !== 'string' || token.length > 4096) return null;
    const secret = jwtSecret();
    let claims: string | jwt.JwtPayload;

    try {
        claims = jwt.verify(token, secret, { algorithms: ['HS256'], issuer, audience: scope });
    } catch {
        return null;
    }

    if (typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' ||
        !/^[a-f0-9]{24}$/.test(claims.sub) || !/^[a-f0-9]{24}$/.test(claims.sid) || typeof claims.exp !== 'number') {
        return null;
    }

    const session = await Session.findOne({
        _id: claims.sid,
        userId: claims.sub,
        expiresAt: { $gt: new Date() },
    }).select('expiresAt').lean();

    return session ? { userId: claims.sub, sessionId: claims.sid, expiresAt: session.expiresAt } : null;
}
