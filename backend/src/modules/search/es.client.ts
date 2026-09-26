import { Client } from '@elastic/elasticsearch';
import { env } from '../../config/env';

export const EMAILS_INDEX = 'emails';

export const esClient = new Client({ node: env.ELASTICSEARCH_URL });

export const emailsIndexMapping = {
  mappings: {
    properties: {
      toEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
      subject: { type: 'text' },
      body: { type: 'text' },
      status: { type: 'keyword' },
      senderId: { type: 'keyword' },
      userId: { type: 'keyword' },
      campaignId: { type: 'keyword' },
      scheduledAt: { type: 'date' },
      sentAt: { type: 'date' },
    },
  },
} as const;

export async function ensureEmailsIndex(): Promise<void> {
  const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
  if (!exists) {
    await esClient.indices.create({ index: EMAILS_INDEX, ...emailsIndexMapping });
  }
}
