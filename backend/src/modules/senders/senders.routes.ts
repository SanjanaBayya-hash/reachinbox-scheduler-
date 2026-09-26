import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { listActiveSenders } from './senders.service';

export const sendersRouter = Router();

sendersRouter.get('/', requireAuth, async (_req, res) => {
  const senders = await listActiveSenders();
  res.json({ senders });
});
