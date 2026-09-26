import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth/auth.middleware';
import { listEmails, searchEmails } from './emails.service';

export const emailsRouter = Router();

const listQuerySchema = z.object({
  tab: z.enum(['scheduled', 'sent']).default('scheduled'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

emailsRouter.get('/', requireAuth, async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await listEmails({ userId: req.authUser!.id, ...parsed.data });
  res.json(result);
});

const searchQuerySchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
});

emailsRouter.get('/search', requireAuth, async (req, res) => {
  const parsed = searchQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const results = await searchEmails({
    userId: req.authUser!.id,
    query: parsed.data.q,
    status: parsed.data.status,
  });
  res.json({ results });
});
