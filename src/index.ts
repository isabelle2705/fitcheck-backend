import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerUploadRoutes } from './routes/upload.js';
import { registerTryonRoutes } from './routes/tryon.js';
import { registerResultRoutes } from './routes/result.js';
import { registerUserRoutes } from './routes/users.js';
import { registerGenerateRoutes } from './routes/generate.js';
import { setupWebSocket } from './ws/handler.js';
import { startWorker } from './queue/worker.js';

const fastify = Fastify({ logger: true });

await fastify.register(cors, { origin: true });
await fastify.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
await fastify.register(websocket);

await registerHealthRoutes(fastify);
await registerUploadRoutes(fastify);
await registerTryonRoutes(fastify);
await registerResultRoutes(fastify);
await registerUserRoutes(fastify);
await registerGenerateRoutes(fastify);
setupWebSocket(fastify);

startWorker();

try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`[server] listening on port ${config.port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
