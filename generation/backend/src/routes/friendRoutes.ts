import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { sendFriendRequest } from '../controllers/friendController';

const router = Router();

router.post('/:username/friend-request', requireAuth, sendFriendRequest);

export default router;