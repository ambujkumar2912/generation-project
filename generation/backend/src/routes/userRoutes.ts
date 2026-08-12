import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { getUserByUsername, searchUsers, updateMyUsername } from '../controllers/userController';

const router = Router();
const searchLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many searches. Please try again shortly.' } });
const usernameChangeLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many username attempts. Please try again later.' } });
router.get('/search', requireAuth, searchLimiter, searchUsers);
router.patch('/me/username', requireAuth, usernameChangeLimiter, updateMyUsername);
router.get('/:username', requireAuth, searchLimiter, getUserByUsername);
export default router;
