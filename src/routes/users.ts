import { FastifyInstance } from 'fastify';
import { createUser, getUser, setSoulId } from '../models/user.js';
import { getUserFeed } from '../models/generation.js';
import { createSoulId } from '../services/higgsfield.js';

export async function registerUserRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /users — create a new user
  fastify.post<{ Body: { userId?: string } }>('/users', async (request, reply) => {
    const { randomUUID } = await import('crypto');
    const userId = (request.body as { userId?: string })?.userId ?? randomUUID();

    const existing = await getUser(userId);
    if (existing) {
      reply.status(409);
      return { error: 'User already exists' };
    }

    const user = await createUser(userId);
    reply.status(201);
    return { id: user.id, points: user.points };
  });

  // GET /users/:userId — get user info
  fastify.get<{ Params: { userId: string } }>('/users/:userId', async (request, reply) => {
    const { userId } = request.params;
    const user = await getUser(userId);

    if (!user) {
      reply.status(404);
      return { error: 'User not found' };
    }

    return {
      id: user.id,
      points: user.points,
      soulId: user.soulId ?? null,
      createdAt: user.createdAt,
    };
  });

  // POST /users/:userId/soul-id — create Higgsfield soul ID
  fastify.post<{
    Params: { userId: string };
    Body: { imageUrls: string[] };
  }>('/users/:userId/soul-id', async (request, reply) => {
    const { userId } = request.params;
    const { imageUrls } = request.body ?? {};

    if (!Array.isArray(imageUrls) || imageUrls.length === 0) {
      reply.status(400);
      return { error: 'imageUrls must be a non-empty array' };
    }

    const user = await getUser(userId);
    if (!user) {
      reply.status(404);
      return { error: 'User not found' };
    }

    const { soul_id } = await createSoulId(imageUrls);
    await setSoulId(userId, soul_id);

    return { soulId: soul_id };
  });

  // GET /users/:userId/feed — get user's generation feed
  fastify.get<{
    Params: { userId: string };
    Querystring: { limit?: string };
  }>('/users/:userId/feed', async (request, reply) => {
    const { userId } = request.params;
    const limit = parseInt((request.query as { limit?: string }).limit ?? '50', 10);

    const user = await getUser(userId);
    if (!user) {
      reply.status(404);
      return { error: 'User not found' };
    }

    const feed = await getUserFeed(userId, limit);
    return { feed };
  });
}
