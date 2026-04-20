import { FastifyInstance } from 'fastify';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health', async (_request, reply) => {
    reply.status(200);
    return { status: 'ok', timestamp: new Date().toISOString() };
  });
}
