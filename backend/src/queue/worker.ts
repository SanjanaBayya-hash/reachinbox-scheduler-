import { DelayedError, Worker, type Job } from 'bullmq';
import { getTestMessageUrl } from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { QUEUE_NAME, EMAIL_STATUS } from '../config/constants';
import { prisma } from '../db/prisma';
import { createRedisConnection } from './redis';
import type { EmailJobData } from './producer';
import {
  computeNextWindowSlot,
  refundHourlyCounter,
  tryIncrHourlyCounter,
  tryReserveSendSlot,
} from './rateLimiter';
import {
  claimEmailForSending,
  incrementAttempts,
  markEmailFailed,
  markEmailRateLimited,
  markEmailSent,
} from '../modules/emails/emails.service';
import { getTransportForSender } from '../modules/senders/senderPool';
import { indexEmail } from '../modules/search/emailIndexer';
import { notifyRateLimitHit } from '../modules/slack/slack.service';
import { runBootReconciliation } from './reconcile';

async function processEmailJob(job: Job<EmailJobData>, token?: string): Promise<void> {
  const email = await prisma.email.findUnique({
    where: { id: job.data.emailId },
    include: { sender: true, campaign: true },
  });

  if (!email) {
    logger.warn({ emailId: job.data.emailId }, 'Email not found, skipping (likely deleted)');
    return;
  }

  if (email.status === EMAIL_STATUS.SENT || email.status === EMAIL_STATUS.FAILED) {
    return; // Idempotent no-op: already terminal.
  }

  const effectiveHourlyLimit = Math.min(
    email.campaign.hourlyLimit,
    email.sender.hourlyLimit ?? env.MAX_EMAILS_PER_HOUR_PER_SENDER,
  );

  const { allowed: withinHourlyLimit, hourKey } = await tryIncrHourlyCounter(
    email.senderId,
    effectiveHourlyLimit,
  );

  if (!withinHourlyLimit) {
    const nextAttemptAt = computeNextWindowSlot(
      email.seq,
      effectiveHourlyLimit,
      email.campaign.delayBetweenMs,
    );

    await markEmailRateLimited(email.id, nextAttemptAt);
    await indexEmail({ ...email, status: EMAIL_STATUS.RATE_LIMITED, scheduledAt: nextAttemptAt });
    await notifyRateLimitHit({
      userId: email.userId,
      senderName: email.sender.name,
      hourKey,
    });

    await job.moveToDelayed(nextAttemptAt.getTime(), token);
    throw new DelayedError();
  }

  const minGapMs = env.MIN_DELAY_BETWEEN_EMAILS_MS;
  const { allowed: slotReserved, nextAvailableAt } = await tryReserveSendSlot(
    email.senderId,
    minGapMs,
  );

  if (!slotReserved) {
    await refundHourlyCounter(email.senderId, hourKey);
    await markEmailRateLimited(email.id, nextAvailableAt);
    await indexEmail({ ...email, status: EMAIL_STATUS.RATE_LIMITED, scheduledAt: nextAvailableAt });
    await job.moveToDelayed(nextAvailableAt.getTime(), token);
    throw new DelayedError();
  }

  const claimed = await claimEmailForSending(email.id);
  if (!claimed) {
    return; // Another worker already has this job (should be rare: jobId dedupes).
  }

  try {
    const transport = getTransportForSender(email.sender);
    const info = await transport.sendMail({
      // Use the sender's real SMTP auth username for the envelope/From address
      // (not the display `email` column, which can be a synthetic value when
      // multiple Sender rows share one underlying Ethereal test account).
      from: `"${email.sender.name}" <${email.sender.smtpUser}>`,
      to: email.toEmail,
      subject: email.subject,
      html: email.body,
    });

    const previewUrl = getTestMessageUrl(info) || null;
    const sent = await markEmailSent(email.id, { messageId: info.messageId, previewUrl });
    await indexEmail(sent);
  } catch (err) {
    await incrementAttempts(email.id);
    const attemptsMade = job.attemptsMade + 1;
    const maxAttempts = job.opts.attempts ?? env.JOB_ATTEMPTS;

    if (attemptsMade >= maxAttempts) {
      const failed = await markEmailFailed(email.id, (err as Error).message);
      await indexEmail(failed);
      return; // Let this attempt "succeed" from BullMQ's view; status already terminal.
    }

    throw err; // BullMQ retries with exponential backoff.
  }
}

export function startWorker(): Worker<EmailJobData> {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,
    limiter: {
      max: 1,
      duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
    },
  });

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'Email job failed permanently');
  });

  worker.on('error', (err) => {
    logger.error({ err }, 'Worker error');
  });

  return worker;
}

async function main() {
  await runBootReconciliation();
  const worker = startWorker();
  logger.info(`Worker started (concurrency=${env.WORKER_CONCURRENCY})`);

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, closing worker gracefully`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'Failed to start worker');
    process.exit(1);
  });
}
