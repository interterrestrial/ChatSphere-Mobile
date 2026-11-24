import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../http';
import { resolveIdentity, type Identity } from '../utils/authUtils';

export interface AuthRequest extends Request {
    identity?: Identity;
}

export function identity(req: AuthRequest) {
    if (!req.identity) throw new HttpError(401, 'Sign in to continue');
    return req.identity;
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
    const bearer = /^Bearer (\S+)$/i.exec(req.headers.authorization || '')?.[1];
    const verified = await resolveIdentity(bearer, 'session');
    if (!verified) throw new HttpError(401, 'Sign in to continue');
    req.identity = verified;
    next();
}
