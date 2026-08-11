import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login } from '../controllers/authController';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again later.' },
});

router.post('/register', registerLimiter, register);
router.post('/login', loginLimiter, login);

export default router;
