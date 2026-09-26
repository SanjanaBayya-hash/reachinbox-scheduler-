import { prisma } from '../../db/prisma';
import { hashKey } from '../../utils/crypto';
import { BULK_CREATE_CHUNK_SIZE } from '../../config/constants';
import { enqueueEmailsBulk } from '../../queue/producer';
import { indexEmailsBulk } from '../search/emailIndexer';
import { listActiveSenders } from '../senders/senders.service';
import type { CreateCampaignInput } from './campaigns.schema';

export class NoActiveSendersError extends Error {
  constructor() {
    super('No active senders are configured. Run the Ethereal seed script first.');
  }
}

export async function createCampaign(userId: string, input: CreateCampaignInput) {
  const senders = await listActiveSenders();
  if (senders.length === 0) {
    throw new NoActiveSendersError();
  }

  // Dedupe leads within this request while preserving order.
  const seen = new Set<string>();
  const leads: string[] = [];
  let duplicateCount = 0;
  for (const raw of input.leads) {
    const email = raw.trim().toLowerCase();
    if (seen.has(email)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(email);
    leads.push(email);
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId,
      subject: input.subject,
      body: input.body,
      startAt: input.startAt,
      delayBetweenMs: input.delayBetweenMs,
      hourlyLimit: input.hourlyLimit,
      totalCount: leads.length,
    },
  });

  // Round-robin senders; each sender paces its own timeline independently.
  const perSenderSeq = new Map<string, number>();
  const rows = leads.map((toEmail, i) => {
    const sender = senders[i % senders.length];
    const seq = perSenderSeq.get(sender.id) ?? 0;
    perSenderSeq.set(sender.id, seq + 1);

    const scheduledAt = new Date(input.startAt.getTime() + seq * input.delayBetweenMs);
    return {
      campaignId: campaign.id,
      userId,
      senderId: sender.id,
      toEmail,
      subject: input.subject,
      body: input.body,
      scheduledAt,
      seq,
      idempotencyKey: hashKey(`${campaign.id}:${toEmail}`),
    };
  });

  await prisma.email.createMany({ data: rows, skipDuplicates: true });

  const createdEmails = await prisma.email.findMany({
    where: { campaignId: campaign.id },
  });

  for (let i = 0; i < createdEmails.length; i += BULK_CREATE_CHUNK_SIZE) {
    const chunk = createdEmails.slice(i, i + BULK_CREATE_CHUNK_SIZE);
    await enqueueEmailsBulk(chunk.map((e) => ({ emailId: e.id, scheduledAt: e.scheduledAt })));
  }

  await indexEmailsBulk(createdEmails);

  return {
    campaign,
    scheduledCount: createdEmails.length,
    duplicateCount,
  };
}
