import { emailQueue } from './queues';

export interface EmailJobData {
  emailId: string;
}

export async function enqueueEmail(emailId: string, scheduledAt: Date): Promise<void> {
  const delay = Math.max(0, scheduledAt.getTime() - Date.now());
  await emailQueue.add(
    'send-email',
    { emailId } satisfies EmailJobData,
    {
      jobId: emailId,
      delay,
    },
  );
}

export async function enqueueEmailsBulk(
  items: Array<{ emailId: string; scheduledAt: Date }>,
): Promise<void> {
  const now = Date.now();
  await emailQueue.addBulk(
    items.map(({ emailId, scheduledAt }) => ({
      name: 'send-email',
      data: { emailId } satisfies EmailJobData,
      opts: {
        jobId: emailId,
        delay: Math.max(0, scheduledAt.getTime() - now),
      },
    })),
  );
}
