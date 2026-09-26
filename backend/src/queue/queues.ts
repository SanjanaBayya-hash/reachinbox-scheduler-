import { Queue } from 'bullmq';
import { QUEUE_NAME } from '../config/constants';
import { env } from '../config/env';
import { createRedisConnection } from './redis';

export const emailQueue = new Queue(QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: env.JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 60 * 60 * 24, count: 5000 },
    removeOnFail: { age: 60 * 60 * 24 * 7 },
  },
});
