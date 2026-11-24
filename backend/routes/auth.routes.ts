import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { MongoRateLimitStore } from '../utils/rateLimitStore';
import { register, login, googleAuth, chooseUsername, getSession, socketTicket, logout } from '../controllers/auth.controller';
import { requireAuth } from '../middlewares/authMiddleware';

const router = Router();
const authAttempts = rateLimit({
    windowMs: 15 * 60_000, limit: 35, standardHeaders: 'draft-8', legacyHeaders: false,
    store: new MongoRateLimitStore('signin'), message: { message: 'Too many sign-in attempts. Try again later' },
});
const signupLimit = rateLimit({
    windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    store: new MongoRateLimitStore('signup'),
    message: { message: 'Too many account requests. Try again later' },
});

router.post('/register', signupLimit, register);
router.post('/login', authAttempts, login);
router.post('/google', authAttempts, googleAuth);
router.post('/choose-username', requireAuth, chooseUsername);
router.get('/session', requireAuth, getSession);
router.get('/socket-ticket', requireAuth, socketTicket);
router.post('/logout', requireAuth, logout);

export default router;
