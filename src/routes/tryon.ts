import { FastifyInstance } from 'fastify';
import { tryonQueue } from '../queue/queue.js';
import type { TryonJob } from '../agents/types.js';
import { randomUUID } from 'crypto';

export async function registerTryonRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: { person_asset_id: string; garment_asset_ids: string[] } }>(
    '/tryon',
    async (request, reply) => {
      const { person_asset_id, garment_asset_ids } = request.body ?? {};

      if (!person_asset_id || typeof person_asset_id !== 'string') {
        reply.status(400);
        return { error: 'person_asset_id is required' };
      }

      if (!Array.isArray(garment_asset_ids) || garment_asset_ids.length === 0) {
        reply.status(400);
        return { error: 'garment_asset_ids must be a non-empty array of strings' };
      }

      for (const id of garment_asset_ids) {
        if (typeof id !== 'string' || !id) {
          reply.status(400);
          return { error: 'Each garment_asset_id must be a non-empty string' };
        }
      }

      const jobId = randomUUID();
      const sessionId = person_asset_id;

      const job: TryonJob = {
        id: jobId,
        person_asset_id,
        garment_asset_ids,
        status: 'queued',
      };

      await tryonQueue.add(sessionId, job, { delay: 0 });

      return { job_id: jobId };
    }
  );
}
