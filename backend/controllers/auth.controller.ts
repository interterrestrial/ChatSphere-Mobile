import type { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/user.model';
import Session from '../models/session.model';
import PushDevice from '../models/pushDevice.model';
import { comparePasswords, createSession, createSocketTicket, hashPassword } from '../utils/authUtils';
import { identity, type AuthRequest } from '../middlewares/authMiddleware';
import { duplicateKey, HttpError, textField } from '../http';
import { readConfig } from '../config';
import { disconnectSession } from '../utils/socket';

const google = new OAuth2Client();
// A fixed dummy hash keeps absent accounts on the same password comparison path.
const dummyHash = '$2b$12$hcjf0VyCBJFd5zsp6d1SU..dlSbyB3R3/cbC3PK.4D0ePh.RNpzxO';
const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validUsername = (username: string) => /^[a-z0-9_]{3,20}$/.test(username);

function publicUser(user: { id: string; name: string; email: string; username?: string | null; isUsernameSet?: boolean }) {
    return { _id: user.id, name: user.name, email: user.email, username: user.username, isUsernameSet: user.isUsernameSet };
}

export async function register(req: Request, res: Response) {
    const { name, email, password, username } = req.body ?? {};
    const nameValue = textField(name, 80);
    const emailValue = textField(email, 254).toLowerCase();
    const usernameValue = username == null ? undefined : textField(username, 20).toLowerCase();
    if (!nameValue || !validEmail(emailValue) || typeof password !== 'string' ||
        password.length < 8 || Buffer.byteLength(password) > 72) {
        throw new HttpError(400, 'Enter a name, a valid email, and a password of at least 8 characters and at most 72 bytes');
    }
    if (usernameValue !== undefined && !validUsername(usernameValue)) {
        throw new HttpError(400, 'Use 3 to 20 letters, numbers, or underscores for your username');
    }
    try {
        const user = await User.create({
            name: nameValue, email: emailValue, password: await hashPassword(password),
            username: usernameValue, isUsernameSet: !!usernameValue,
        });
        res.status(201).json({ user: publicUser(user), token: await createSession(user.id) });
    } catch (error) {
        if (duplicateKey(error)) throw new HttpError(409, 'That email or username is already in use');
        throw error;
    }
}

export async function login(req: Request, res: Response) {
    const { identifier, password } = req.body ?? {};
    const value = textField(identifier, 254).toLowerCase();
    if (!value || typeof password !== 'string' || !password || Buffer.byteLength(password) > 512) {
        throw new HttpError(400, 'Enter your email or username and password');
    }
    const user = await User.findOne({ $or: [{ email: value }, { username: value }] }).select('+password');
    const valid = await comparePasswords(password, user?.password || dummyHash);
    if (!user?.password || !valid) throw new HttpError(401, 'Invalid email, username, or password');
    res.json({ user: publicUser(user), token: await createSession(user.id) });
}

export async function googleAuth(req: Request, res: Response) {
    const { googleClientIds } = readConfig();
    if (!googleClientIds.length) throw new HttpError(503, 'Google sign-in is unavailable');
    const idToken = textField(req.body?.idToken, 4096);
    if (!idToken) throw new HttpError(400, 'Google ID token is required');

    const ticket = await google.verifyIdToken({ idToken, audience: googleClientIds }).catch(() => null);
    const profile = ticket?.getPayload();
    const email = textField(profile?.email, 254).toLowerCase();
    if (!profile?.sub || !profile.email_verified || !validEmail(email)) {
        throw new HttpError(401, 'Google sign-in could not be verified');
    }

    const googleId = profile.sub;
    let user = await User.findOne({ googleId });
    if (!user) {
        try {
            user = await User.create({ googleId, email, name: profile.name?.trim().slice(0, 80) || email.split('@')[0].slice(0, 80) });
        } catch (error) {
            if (!duplicateKey(error)) throw error;
            user = await User.findOne({ googleId });
            if (!user) throw new HttpError(409, 'This email already has an account. Use your original sign-in method');
        }
    }
    res.json({ user: publicUser(user), token: await createSession(user.id) });
}

export async function chooseUsername(req: AuthRequest, res: Response) {
    const username = textField(req.body?.username, 20).toLowerCase();
    if (!validUsername(username)) throw new HttpError(400, 'Use 3 to 20 letters, numbers, or underscores');
    try {
        const user = await User.findByIdAndUpdate(identity(req).userId, { username, isUsernameSet: true }, { returnDocument: 'after' });
        if (!user) throw new HttpError(401, 'Sign in to continue');
        res.json({ user: publicUser(user) });
    } catch (error) {
        if (duplicateKey(error)) throw new HttpError(409, 'That username is already in use');
        throw error;
    }
}

export async function getSession(req: AuthRequest, res: Response) {
    const user = await User.findById(identity(req).userId);
    if (!user) throw new HttpError(401, 'Sign in to continue');
    res.json({ user: publicUser(user) });
}

export function socketTicket(req: AuthRequest, res: Response) {
    res.json({ token: createSocketTicket(identity(req)) });
}

export async function logout(req: AuthRequest, res: Response) {
    const { userId, sessionId } = identity(req);
    await Session.deleteOne({ _id: sessionId, userId });
    disconnectSession(sessionId);
    await PushDevice.deleteMany({ userId, sessionId });
    res.status(204).end();
}
