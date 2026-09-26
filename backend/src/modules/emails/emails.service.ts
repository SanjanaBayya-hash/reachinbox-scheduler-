import { prisma } from '../../db/prisma';
import { EMAIL_STATUS, SCHEDULED_TAB_STATUSES, SENT_TAB_STATUSES } from '../../config/constants';
import { esClient, EMAILS_INDEX } from '../search/es.client';

/**
 * Atomically transitions an email from a claimable state to `sending`.
 * Returns false if another worker already claimed it (0 rows affected).
 */
export async function claimEmailForSending(emailId: string): Promise<boolean> {
  const { count } = await prisma.email.updateMany({
    where: { id: emailId, status: { in: [EMAIL_STATUS.SCHEDULED, EMAIL_STATUS.RATE_LIMITED] } },
    data: { status: EMAIL_STATUS.SENDING },
  });
  return count > 0;
}

export async function markEmailRateLimited(emailId: string, scheduledAt: Date) {
  return prisma.email.update({
    where: { id: emailId },
    data: { status: EMAIL_STATUS.RATE_LIMITED, scheduledAt },
  });
}

export async function markEmailSent(
  emailId: string,
  data: { messageId: string; previewUrl: string | null },
) {
  return prisma.email.update({
    where: { id: emailId },
    data: {
      status: EMAIL_STATUS.SENT,
      sentAt: new Date(),
      messageId: data.messageId,
      previewUrl: data.previewUrl,
      error: null,
    },
  });
}

export async function markEmailFailed(emailId: string, error: string) {
  return prisma.email.update({
    where: { id: emailId },
    data: { status: EMAIL_STATUS.FAILED, error },
  });
}

export async function incrementAttempts(emailId: string) {
  return prisma.email.update({
    where: { id: emailId },
    data: { attempts: { increment: 1 } },
  });
}

export interface ListEmailsParams {
  userId: string;
  tab: 'scheduled' | 'sent';
  page: number;
  limit: number;
}

export async function listEmails({ userId, tab, page, limit }: ListEmailsParams) {
  const statuses = tab === 'scheduled' ? SCHEDULED_TAB_STATUSES : SENT_TAB_STATUSES;
  const orderBy = tab === 'scheduled' ? { scheduledAt: 'asc' as const } : { sentAt: 'desc' as const };

  const [items, total] = await Promise.all([
    prisma.email.findMany({
      where: { userId, status: { in: statuses } },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: { sender: { select: { name: true, email: true } } },
    }),
    prisma.email.count({ where: { userId, status: { in: statuses } } }),
  ]);

  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export interface SearchEmailsParams {
  userId: string;
  query?: string;
  status?: string;
}

export async function searchEmails({ userId, query, status }: SearchEmailsParams) {
  const filter: any[] = [{ term: { userId } }];
  if (status) filter.push({ term: { status } });

  const result = await esClient.search({
    index: EMAILS_INDEX,
    query: {
      bool: {
        filter,
        must: query
          ? [{ multi_match: { query, fields: ['toEmail', 'subject', 'body'] } }]
          : [{ match_all: {} }],
      },
    },
    size: 100,
    sort: [{ scheduledAt: 'desc' }],
  });

  return result.hits.hits.map((hit) => ({ id: hit._id, ...(hit._source as object) }));
}
