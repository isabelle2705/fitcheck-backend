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
      // Worker stores result in returnvalue; progress is a legacy fallback
      const returnval = job.returnvalue as { composite_url?: string; result_url?: string; score?: number } | null;
      const prog = (typeof progress === 'object' && progress !== null
        ? progress as { composite_url?: string; score?: number }
        : {}) as { composite_url?: string; score?: number };

      const composite_url = returnval?.composite_url ?? returnval?.result_url ?? prog.composite_url;
      const score = returnval?.score ?? prog.score;

      return { status: 'done', composite_url, score };
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
