import { FastifyInstance } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const MAX_BYTES = 20 * 1024 * 1024;

function getR2Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey,
    },
  });
}

export async function registerUploadRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/upload', async (request, reply) => {
    let file: Awaited<ReturnType<typeof request.file>> | null = null;
    try {
      file = await request.file();
    } catch {
      reply.status(400);
      return { error: 'No file provided' };
    }

    if (!file) {
      reply.status(400);
      return { error: 'No file provided' };
    }

    const mimeType = file.mimetype;
    if (!ALLOWED_TYPES.has(mimeType)) {
      reply.status(415);
      return { error: 'Unsupported file type. Allowed: jpeg, png, heic' };
    }

    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk as Buffer);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_BYTES) {
      reply.status(413);
      return { error: 'File too large. Max 20MB.' };
    }

    const assetId = randomUUID();
    const ext = mimeType === 'image/png' ? 'png' : 'jpg';
    const key = `uploads/${assetId}.${ext}`;

    if (config.r2.accountId) {
      const r2 = getR2Client();
      await r2.send(new PutObjectCommand({
        Bucket: config.r2.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      }));
    }

    const publicUrl = config.r2.publicUrl
      ? `${config.r2.publicUrl}/${key}`
      : `mock://${key}`;

    return { asset_id: assetId, url: publicUrl };
  });
}
