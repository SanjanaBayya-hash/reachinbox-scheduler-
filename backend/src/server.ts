import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { prisma } from './db/prisma';
import { redis } from './queue/redis';
import { ensureEmailsIndex } from './modules/search/es.client';

async function main() {
  await ensureEmailsIndex().catch((err) => logger.warn({ err }, 'Could not ensure ES index'));

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down API server`);
    server.close();
    await Promise.all([prisma.$disconnect(), redis.quit()]);
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'Failed to start API server');
  process.exit(1);
});
