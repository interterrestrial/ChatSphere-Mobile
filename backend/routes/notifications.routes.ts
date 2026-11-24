import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { duplicateKey, HttpError } from '../http';
import { identity, requireAuth } from '../middlewares/authMiddleware';
import PushDevice from '../models/pushDevice.model';
import { MongoRateLimitStore } from '../utils/rateLimitStore';

const router = Router();
const installationIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function installationId(value: unknown) {
    if (typeof value !== 'string' || !installationIdPattern.test(value)) {
        throw new HttpError(400, 'Invalid installation ID');
    }
    return value.toLowerCase();
}

router.use(requireAuth, rateLimit({
    windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    store: new MongoRateLimitStore('notifications'),
    keyGenerator: req => identity(req).userId,
    message: { message: 'Too many notification registration attempts' },
}));

router.post('/register', async (req, res) => {
    const id = installationId(req.body?.installationId);
    const token = req.body?.registrationToken;
    if (typeof token !== 'string' || !/^\S{20,2048}$/.test(token)) {
        throw new HttpError(400, 'Invalid notification registration token');
    }
    const { userId, sessionId, expiresAt } = identity(req);

    try {
        await PushDevice.updateOne({ _id: id }, {
            $set: { registrationToken: token, userId, sessionId, expiresAt },
        }, { upsert: true });
    } catch (error) {
        if (duplicateKey(error)) throw new HttpError(409, 'This notification token is already registered');
        throw error;
    }
    res.status(204).end();
});

router.post('/unregister', async (req, res) => {
    const id = installationId(req.body?.installationId);
    const { userId, sessionId } = identity(req);
    await PushDevice.deleteOne({ _id: id, userId, sessionId });
    res.status(204).end();
});

export default router;
