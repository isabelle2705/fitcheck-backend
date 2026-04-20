import { FastifyInstance } from 'fastify';
import { tryonQueue } from '../queue/queue.js';

export async function registerResultRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { job_id: string } }>('/result/:job_id', async (request, reply) => {
    const { job_id } = request.params;

    if (!job_id) {
      reply.status(400);
      return { error: 'job_id is required' };
    }

    const job = await tryonQueue.getJob(job_id);

    if (!job) {
      reply.status(404);
      return { error: 'Job not found' };
    }

    const state = await job.getState();
    const progress = job.progress;

    if (state === 'completed') {
      const result = (typeof progress === 'object' && progress !== null
        ? progress as { composite_url?: string; score?: number }
        : {}) as { composite_url?: string; score?: number };
      return {
        status: 'done',
        composite_url: result.composite_url,
        score: result.score,
      };
    }

    if (state === 'failed') {
      return {
        status: 'failed',
        issues: [job.failedReason ?? 'Unknown error'],
      };
    }

    return {
      status: state === 'active' ? 'processing' : state,
    };
  });
}
