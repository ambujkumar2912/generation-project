import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { createTextPost, deleteOwnPost, getUserPosts, getPostsByUsername, getGenerationFeed } from '../controllers/postController';

const router = Router();
const createPostLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many posts. Please try again in a minute.' } });
router.get('/', requireAuth, getGenerationFeed);
router.post('/', requireAuth, createPostLimiter, createTextPost);
router.get('/me', requireAuth, getUserPosts);
router.get('/user/:username', requireAuth, getPostsByUsername);
router.delete('/:postId', requireAuth, deleteOwnPost);
export default router;
