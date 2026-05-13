import { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import { getUser, deductPoints } from '../models/user.js';
import { saveGeneration } from '../models/generation.js';
import { generateOutfitShot } from '../services/higgsfield.js';
import { tryonQueue } from '../queue/queue.js';
import { config } from '../config.js';

interface GenerateBody {
  userId: string;
  garmentImageUrls: string[];
  brandPaid?: boolean;
}

export async function registerGenerateRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: GenerateBody }>('/generate', async (request, reply) => {
    const { userId, garmentImageUrls, brandPaid = false } = request.body ?? {};

    if (!userId || typeof userId !== 'string') {
      reply.status(400);
      return { error: 'userId is required' };
    }

    if (!Array.isArray(garmentImageUrls) || garmentImageUrls.length === 0) {
      reply.status(400);
      return { error: 'garmentImageUrls must be a non-empty array' };
    }

    // Look up user
    const user = await getUser(userId);
    if (!user) {
      reply.status(404);
      return { error: 'User not found' };
    }

    if (!user.soulId) {
      reply.status(422);
      return { error: 'User has no soul ID. POST /users/:userId/soul-id first.' };
    }

    // Deduct points unless brand-paid
    let pointsRemaining = user.points;
    if (!brandPaid) {
      const result = await deductPoints(userId, config.pointsPerGeneration);
      if (!result.success) {
        reply.status(402);
        return {
          error: 'Insufficient points',
          pointsRequired: config.pointsPerGeneration,
          pointsRemaining: result.remaining,
        };
      }
      pointsRemaining = result.remaining;
    }

    // Call Higgsfield
    let jobId: string;
    try {
      const res = await generateOutfitShot(user.soulId, garmentImageUrls);
      jobId = res.job_id;
    } catch (err) {
      // Refund points on Higgsfield failure
      if (!brandPaid) {
        const { addPoints } = await import('../models/user.js');
        await addPoints(userId, config.pointsPerGeneration);
        pointsRemaining += config.pointsPerGeneration;
      }
      fastify.log.error(err, 'Higgsfield generateOutfitShot failed');
      reply.status(502);
      return { error: 'Failed to start generation. Points refunded.' };
    }

    // Save generation record
    const generationId = randomUUID();
    await saveGeneration({
      id: generationId,
      userId,
      jobId,
      status: 'processing',
      garmentIds: garmentImageUrls,
      soulId: user.soulId,
      createdAt: new Date().toISOString(),
      brandPaid,
    });

    // Enqueue BullMQ job for polling.
    // jobId: generationId ensures getJob(generationId) works in the result route.
    await tryonQueue.add(
      userId,
      {
        id: generationId,
        person_asset_id: user.soulId,
        garment_asset_ids: garmentImageUrls,
        status: 'queued',
        // Extra fields carried through as job data
        higgsfield_job_id: jobId,
      } as GenerateJobData,
      { delay: 0, jobId: generationId }
    );

    return { generationId, jobId, pointsRemaining };
  });
}

// Extended job data shape used only for the generate → worker path
export interface GenerateJobData {
  id: string;
  person_asset_id: string;
  garment_asset_ids: string[];
  status: 'queued';
  higgsfield_job_id: string;
}
