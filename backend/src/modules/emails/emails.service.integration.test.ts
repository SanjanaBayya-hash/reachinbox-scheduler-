/**
 * Integration test against a real Postgres (the Docker `postgres` service, schema
 * migrated). Verifies the atomic claim that backs "no duplicate sends": two
 * concurrent workers racing on the same email row, only one should win.
 *
 * Run: docker compose up -d postgres && npm run prisma:migrate --workspace backend
 *      then npm test --workspace backend
 */
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../db/prisma';
import { encrypt } from '../../utils/crypto';
import { claimEmailForSending, markEmailSent } from './emails.service';

let userId: string;
let senderId: string;
let campaignId: string;

async function createEmail(overrides: Partial<{ status: string; seq: number }> = {}) {
  const email = await prisma.email.create({
    data: {
      campaignId,
      userId,
      senderId,
      toEmail: `lead-${Date.now()}-${Math.random()}@example.com`,
      subject: 'Test',
      body: 'Test body',
      scheduledAt: new Date(),
      seq: overrides.seq ?? 0,
      status: overrides.status ?? 'scheduled',
      idempotencyKey: `${campaignId}:${Math.random()}`,
    },
  });
  return email;
}

describe('claimEmailForSending (idempotent claim)', () => {
  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { googleId: `test-${Date.now()}-${Math.random()}`, email: `u${Math.random()}@test.com`, name: 'Test' },
    });
    userId = user.id;

    const sender = await prisma.sender.create({
      data: {
        name: 'Test Sender',
        email: `sender-${Date.now()}-${Math.random()}@test.com`,
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUser: 'test',
        smtpPass: encrypt('test'),
      },
    });
    senderId = sender.id;

    const campaign = await prisma.campaign.create({
      data: {
        userId,
        subject: 'Test',
        body: 'Test',
        startAt: new Date(),
        delayBetweenMs: 1000,
        hourlyLimit: 100,
        totalCount: 1,
      },
    });
    campaignId = campaign.id;
  });

  // This runs against the real dev database (there's no separate test DB in this
  // setup), so every row created in beforeEach must be torn down here — otherwise
  // it pollutes /api/emails and the dashboard with fake test data.
  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }); // cascades to campaign + emails
    await prisma.sender.delete({ where: { id: senderId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('only one of two concurrent claims on the same email wins', async () => {
    const email = await createEmail();

    const [first, second] = await Promise.all([
      claimEmailForSending(email.id),
      claimEmailForSending(email.id),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);

    const reloaded = await prisma.email.findUniqueOrThrow({ where: { id: email.id } });
    expect(reloaded.status).toBe('sending');
  });

  it('refuses to claim an email that is already sent (idempotent no-op)', async () => {
    const email = await createEmail({ status: 'scheduled' });
    const claimed = await claimEmailForSending(email.id);
    expect(claimed).toBe(true);
    await markEmailSent(email.id, { messageId: 'abc123', previewUrl: null });

    const secondClaim = await claimEmailForSending(email.id);
    expect(secondClaim).toBe(false);
  });

  it('allows re-claiming a rate_limited email (rescheduled into a later window)', async () => {
    const email = await createEmail({ status: 'rate_limited' });
    const claimed = await claimEmailForSending(email.id);
    expect(claimed).toBe(true);
  });
});
