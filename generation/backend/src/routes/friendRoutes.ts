import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { sendFriendRequest, getIncomingFriendRequests, acceptFriendRequest, rejectFriendRequest } from '../controllers/friendController';

const router = Router();

router.post('/:username/friend-request', requireAuth, sendFriendRequest);
router.get('/me/friend-requests', requireAuth, getIncomingFriendRequests);
router.post('/friend-requests/:requestId/accept', requireAuth, acceptFriendRequest);
router.post('/friend-requests/:requestId/reject', requireAuth, rejectFriendRequest);

export default router;