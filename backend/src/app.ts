import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './config/logger';
import { passport } from './modules/auth/passport';
import { requireAuth } from './modules/auth/auth.middleware';
import { authRouter } from './modules/auth/auth.routes';
import { campaignsRouter } from './modules/campaigns/campaigns.routes';
import { emailsRouter } from './modules/emails/emails.routes';
import { sendersRouter } from './modules/senders/senders.routes';
import { slackRouter } from './modules/slack/slack.routes';
import { healthRouter } from './modules/health/health.routes';
import { createBullBoardRouter } from './admin/bullBoard';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({ logger }));
  app.use(passport.initialize());

  app.use('/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/campaigns', campaignsRouter);
  app.use('/api/emails', emailsRouter);
  app.use('/api/senders', sendersRouter);
  app.use('/api/slack', slackRouter);
  app.use('/admin/queues', requireAuth, createBullBoardRouter('/admin/queues'));

  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    req.log?.error({ err }, 'Unhandled error');
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
