import { prisma } from '../db/prisma';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { EMAIL_STATUS } from '../config/constants';
import { enqueueEmail } from './producer';

/**
 * Runs once when the worker boots (never on a timer/cron):
 *  1. Re-adds a BullMQ job for any email still `scheduled`/`rate_limited` — jobId
 *     dedupes against anything already in Redis, so this is always safe to repeat.
 *  2. Resolves emails stuck in `sending` from a crash mid-send: if a messageId was
 *     already recorded, the send succeeded before the crash, so mark it sent;
 *     otherwise mark it failed ("interrupted") rather than risk a duplicate send.
 */
export async function runBootReconciliation(): Promise<void> {
  const reAdded = await reAddOrphanedJobs();
  const resolved = await resolveStuckSendingEmails();
  logger.info({ reAdded, resolved }, 'Boot reconciliation complete');
}

async function reAddOrphanedJobs(): Promise<number> {
  const pending = await prisma.email.findMany({
    where: { status: { in: [EMAIL_STATUS.SCHEDULED, EMAIL_STATUS.RATE_LIMITED] } },
    select: { id: true, scheduledAt: true },
  });

  for (const email of pending) {
    await enqueueEmail(email.id, email.scheduledAt);
  }
  return pending.length;
}

async function resolveStuckSendingEmails(): Promise<number> {
  const cutoff = new Date(Date.now() - env.SENDING_STUCK_TIMEOUT_MIN * 60 * 1000);
  const stuck = await prisma.email.findMany({
    where: { status: EMAIL_STATUS.SENDING, updatedAt: { lt: cutoff } },
  });

  for (const email of stuck) {
    if (email.messageId) {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: EMAIL_STATUS.SENT, sentAt: email.sentAt ?? new Date() },
      });
    } else {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: EMAIL_STATUS.FAILED, error: 'interrupted' },
      });
    }
  }
  return stuck.length;
}
