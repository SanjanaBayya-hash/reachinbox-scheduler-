import { Router } from 'express';
import { prisma } from '../../db/prisma';
import { redis } from '../../queue/redis';
import { esClient } from '../search/es.client';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const checks: Record<string, boolean> = { db: false, redis: false, elasticsearch: false };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch {
    /* left false */
  }

  try {
    checks.redis = (await redis.ping()) === 'PONG';
  } catch {
    /* left false */
  }

  try {
    checks.elasticsearch = await esClient.ping();
  } catch {
    /* left false */
  }

  const healthy = Object.values(checks).every(Boolean);
  res.status(healthy ? 200 : 503).json({ healthy, checks });
});
