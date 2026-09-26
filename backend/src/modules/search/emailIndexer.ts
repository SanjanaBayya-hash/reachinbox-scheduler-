import type { Email } from '@prisma/client';
import { logger } from '../../config/logger';
import { EMAILS_INDEX, esClient } from './es.client';

function toDocument(email: Email) {
  return {
    toEmail: email.toEmail,
    subject: email.subject,
    body: email.body,
    status: email.status,
    senderId: email.senderId,
    userId: email.userId,
    campaignId: email.campaignId,
    scheduledAt: email.scheduledAt,
    sentAt: email.sentAt,
  };
}

export async function indexEmail(email: Email): Promise<void> {
  try {
    await esClient.index({
      index: EMAILS_INDEX,
      id: email.id,
      document: toDocument(email),
      refresh: false,
    });
  } catch (err) {
    logger.warn({ err, emailId: email.id }, 'Failed to index email in Elasticsearch');
  }
}

export async function indexEmailsBulk(emails: Email[]): Promise<void> {
  if (emails.length === 0) return;
  try {
    const operations = emails.flatMap((email) => [
      { index: { _index: EMAILS_INDEX, _id: email.id } },
      toDocument(email),
    ]);
    const result = await esClient.bulk({ operations, refresh: false });
    if (result.errors) {
      logger.warn({ items: result.items.length }, 'Some ES bulk index operations failed');
    }
  } catch (err) {
    logger.warn({ err, count: emails.length }, 'Failed to bulk index emails in Elasticsearch');
  }
}
