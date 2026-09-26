import IORedis from 'ioredis';
import { env } from '../config/env';

export function createRedisConnection(): IORedis {
  return new IORedis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
  });
}

export const redis = createRedisConnection();
