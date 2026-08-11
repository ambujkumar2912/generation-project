import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { getPublicProfile, updateMyProfile } from '../controllers/profileController';

const router = Router();

router.get('/:userId', requireAuth, getPublicProfile);
router.patch('/', requireAuth, updateMyProfile);

export default router;
