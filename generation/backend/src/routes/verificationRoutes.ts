import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { uploadVerificationDocument } from '../middleware/upload';
import {
  submitVerificationRequest,
  getMyVerificationStatus,
  listPendingVerifications,
  reviewVerificationRequest,
} from '../controllers/verificationController';

const router = Router();

// Deprecated legacy workflow: retained temporarily for data-history safety,
// but no longer used by registration or active frontend routes.

router.post('/request', requireAuth, uploadVerificationDocument, submitVerificationRequest);
router.get('/status', requireAuth, getMyVerificationStatus);

// Admin-only moderation endpoints
router.get('/pending', requireAuth, requireAdmin, listPendingVerifications);
router.post('/:requestId/review', requireAuth, requireAdmin, reviewVerificationRequest);

export default router;
