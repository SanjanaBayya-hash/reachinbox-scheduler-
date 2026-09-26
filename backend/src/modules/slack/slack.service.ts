import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { encrypt, decrypt } from '../../utils/crypto';
import { redis } from '../../queue/redis';

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token?: string;
  incoming_webhook?: { channel_id: string; url: string; channel: string };
  team?: { id: string; name: string };
}

export async function exchangeSlackCode(code: string): Promise<SlackOAuthResponse> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
  });
  return (await response.json()) as SlackOAuthResponse;
}

export async function upsertSlackConnection(userId: string, oauth: SlackOAuthResponse) {
  if (!oauth.ok || !oauth.incoming_webhook || !oauth.team || !oauth.access_token) {
    throw new Error(oauth.error ?? 'Slack OAuth exchange failed');
  }

  return prisma.slackConnection.upsert({
    where: { userId },
    update: {
      teamId: oauth.team.id,
      teamName: oauth.team.name,
      channelId: oauth.incoming_webhook.channel_id,
      webhookUrl: oauth.incoming_webhook.url,
      accessToken: encrypt(oauth.access_token),
      connectedAt: new Date(),
      revokedAt: null,
    },
    create: {
      userId,
      teamId: oauth.team.id,
      teamName: oauth.team.name,
      channelId: oauth.incoming_webhook.channel_id,
      webhookUrl: oauth.incoming_webhook.url,
      accessToken: encrypt(oauth.access_token),
    },
  });
}

export async function getSlackStatus(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection || connection.revokedAt) {
    return { connected: false };
  }
  return { connected: true, teamName: connection.teamName, connectedAt: connection.connectedAt };
}

export async function disconnectSlack(userId: string) {
  await prisma.slackConnection.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Notifies the campaign owner's Slack channel once per sender per hour when a rate
 * limit is hit. Dedup key ensures a burst of rate-limited jobs only fires one message.
 */
export async function notifyRateLimitHit(params: {
  userId: string;
  senderName: string;
  hourKey: string;
}): Promise<void> {
  const dedupeKey = `rl-notified:${params.senderName}:${params.hourKey}`;
  const wasSet = await redis.set(dedupeKey, '1', 'EX', 3600, 'NX');
  if (wasSet !== 'OK') return;

  try {
    const connection = await prisma.slackConnection.findFirst({
      where: { userId: params.userId, revokedAt: null },
    });
    if (!connection) return;

    // accessToken is stored encrypted for potential chat:write use; the webhook URL
    // itself is the simple, always-available notification path.
    decrypt(connection.accessToken);

    await fetch(connection.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `:warning: Hourly send limit reached for sender *${params.senderName}* (window ${params.hourKey}). Remaining emails have been rescheduled to the next hour.`,
      }),
    });
  } catch (err) {
    logger.warn({ err }, 'Slack notification failed');
  }
}
