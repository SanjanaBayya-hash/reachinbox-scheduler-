/**
 * Rebuilds the `emails` Elasticsearch index from Postgres. Useful if ES and the
 * DB drift apart (e.g. ES was wiped). Run with: npm run reindex:es --workspace backend
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Client } from '@elastic/elasticsearch';

const EMAILS_INDEX = 'emails';

async function main() {
  const prisma = new PrismaClient();
  const esClient = new Client({ node: process.env.ELASTICSEARCH_URL ?? 'http://localhost:9200' });

  const exists = await esClient.indices.exists({ index: EMAILS_INDEX });
  if (exists) {
    await esClient.indices.delete({ index: EMAILS_INDEX });
  }
  await esClient.indices.create({
    index: EMAILS_INDEX,
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
  });

  const pageSize = 1000;
  let cursor: string | undefined;
  let total = 0;

  for (;;) {
    const batch = await prisma.email.findMany({
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (batch.length === 0) break;

    const operations = batch.flatMap((email) => [
      { index: { _index: EMAILS_INDEX, _id: email.id } },
      {
        toEmail: email.toEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        senderId: email.senderId,
        userId: email.userId,
        campaignId: email.campaignId,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
      },
    ]);
    await esClient.bulk({ operations, refresh: false });

    total += batch.length;
    cursor = batch[batch.length - 1].id;
    console.log(`Indexed ${total} emails so far...`);
  }

  await esClient.indices.refresh({ index: EMAILS_INDEX });
  await prisma.$disconnect();
  console.log(`Done. Reindexed ${total} emails.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
