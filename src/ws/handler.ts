import { FastifyInstance } from 'fastify';
import { connection } from '../queue/queue.js';

export function setupWebSocket(fastify: FastifyInstance): void {
  fastify.get<{ Params: { session_id: string } }>('/ws/:session_id', { websocket: true }, (socket, request) => {
    const sessionId = (request.params as { session_id: string }).session_id;
    const subscriber = connection.duplicate();

    subscriber.subscribe(`fitcheck:session:${sessionId}`, () => {
      socket.socket.on('close', () => {
        subscriber.unsubscribe();
        subscriber.disconnect();
      });

      subscriber.on('message', (_channel: string, message: string) => {
        try {
          const event = JSON.parse(message);
          socket.socket.send(JSON.stringify(event));
        } catch {
          socket.socket.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });
    });

    socket.socket.on('error', (err: Error) => {
      console.error(`[ws] socket error for session ${sessionId}:`, err.message);
    });
  });
}
