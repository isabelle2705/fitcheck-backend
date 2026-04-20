import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config.js';
import type { TryonJob } from '../agents/types.js';

export const connection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export const tryonQueue = new Queue<TryonJob>('tryon', {
  connection,
  defaultJobOptions: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
});

export async function publishStatus(
  sessionId: string,
  event: Record<string, unknown>
): Promise<void> {
  await connection.publish(`fitcheck:session:${sessionId}`, JSON.stringify(event));
}
