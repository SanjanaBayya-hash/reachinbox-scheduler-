/**
 * Schedules N emails through the real campaign-creation path (not a bypass) so the
 * demo shows pacing, hourly overflow, and Bull Board delayed counts under load.
 * Run with: npm run load-test --workspace backend -- --count=1000 --hourlyLimit=50
 */
import 'dotenv/config';
import { prisma } from '../backend/src/db/prisma';
import { createCampaign } from '../backend/src/modules/campaigns/campaigns.service';

function argValue(name: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : fallback;
}

async function main() {
  const count = Number(argValue('count', '1000'));
  const hourlyLimit = Number(argValue('hourlyLimit', '50'));
  const delayBetweenMs = Number(argValue('delayBetweenMs', '2000'));

  const user = await prisma.user.upsert({
    where: { googleId: 'load-test-user' },
    update: {},
    create: {
      googleId: 'load-test-user',
      email: 'load-test@example.com',
      name: 'Load Test User',
    },
  });

  const leads = Array.from({ length: count }, (_, i) => `lead${i}@example.com`);

  const result = await createCampaign(user.id, {
    subject: 'Load test campaign',
    body: '<p>This is a load test email.</p>',
    leads,
    startAt: new Date(),
    delayBetweenMs,
    hourlyLimit,
  });

  console.log(
    `Scheduled ${result.scheduledCount} emails (hourlyLimit=${hourlyLimit}, delayBetweenMs=${delayBetweenMs}).`,
  );
  console.log('Watch /admin/queues for delayed counts and the dashboard for rate_limited rows.');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
