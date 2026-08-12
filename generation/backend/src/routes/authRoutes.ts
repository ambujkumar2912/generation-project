import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, checkPhoneAccount } from '../controllers/authController';
import { env } from '../config/env';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: env.nodeEnv !== 'production' ? 50 : 10,
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
router.post('/phone/check', loginLimiter, checkPhoneAccount);

export default router;
