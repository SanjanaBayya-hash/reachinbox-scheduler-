import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

interface SlackStatePayload {
  userId: string;
}

export function signSlackState(userId: string): string {
  return jwt.sign({ userId } satisfies SlackStatePayload, env.SLACK_STATE_SECRET, {
    expiresIn: '10m',
  });
}

export function verifySlackState(state: string): string {
  const payload = jwt.verify(state, env.SLACK_STATE_SECRET) as SlackStatePayload;
  return payload.userId;
}
