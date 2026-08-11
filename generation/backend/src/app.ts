import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import authRoutes from './routes/authRoutes';
import cohortRoutes from './routes/cohortRoutes';
import verificationRoutes from './routes/verificationRoutes';
import profileRoutes from './routes/profileRoutes';
import { requireAuth } from './middleware/auth';
import { getMe } from './controllers/meController';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.frontendOrigin, credentials: true }));
  app.use(express.json({ limit: '2mb' }));

  // Global rate limit as a baseline anti-abuse measure; individual
  // sensitive routes (e.g. login) apply stricter limits of their own.
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 120,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use('/auth', authRoutes);
  app.get('/me', requireAuth, getMe);
  app.use('/cohorts', cohortRoutes);
  app.use('/verification', verificationRoutes);
  app.use('/profile', profileRoutes);

  // 404 handler
  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // Central error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
  });

  return app;
}
