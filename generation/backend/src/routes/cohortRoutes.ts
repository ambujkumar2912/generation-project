import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { listCohorts } from '../controllers/cohortController';

const router = Router();

router.get('/', requireAuth, listCohorts);

export default router;
