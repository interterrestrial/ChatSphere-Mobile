import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { MongoRateLimitStore } from '../utils/rateLimitStore';
import { identity, requireAuth } from '../middlewares/authMiddleware';
import {
    getConversations, getMessages, sendMessage, createConversation, searchUsers, getAllUsers,
    getSmartReplies, getConversationSummary,
} from '../controllers/chat.controller';

const router = Router();
const aiLimit = rateLimit({
    windowMs: 60_000, limit: 6, standardHeaders: 'draft-8', legacyHeaders: false,
    store: new MongoRateLimitStore('ai'),
    keyGenerator: req => identity(req).userId,
    message: { message: 'Too many requests for chat assistance. Try again shortly' },
});

router.use(requireAuth);
router.get('/users', getAllUsers);
router.get('/users/search', searchUsers);
router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/messages/:conversationId', getMessages);
router.post('/messages', sendMessage);
router.post('/smart-replies', aiLimit, getSmartReplies);
router.get('/summary/:conversationId', aiLimit, getConversationSummary);

export default router;
