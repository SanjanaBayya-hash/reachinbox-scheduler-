import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(16),
  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 bytes (AES-256)'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ELASTICSEARCH_URL: z.string().url(),

  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),

  SLACK_CLIENT_ID: z.string().optional().default(''),
  SLACK_CLIENT_SECRET: z.string().optional().default(''),
  SLACK_REDIRECT_URI: z.string().optional().default(''),
  SLACK_STATE_SECRET: z.string().min(16),

  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(5),
  MIN_DELAY_BETWEEN_EMAILS_MS: z.coerce.number().int().positive().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().int().positive().default(200),
  MAX_EMAILS_PER_HOUR_PER_SENDER: z.coerce.number().int().positive().default(50),
  JOB_ATTEMPTS: z.coerce.number().int().positive().default(3),
  SENDING_STUCK_TIMEOUT_MIN: z.coerce.number().int().positive().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
export type Env = typeof env;
