import { FastifyInstance } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';
import { randomUUID } from 'crypto';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/heic', 'image/heif']);
const MAX_BYTES = 20 * 1024 * 1024;

export async function registerUploadRoutes(fastify: FastifyInstance): Promise<void> {
  const s3 = new S3Client({
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
    },
  });

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

    const chunks: Uint8Array[] = [];
    for await (const chunk of file.data) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_BYTES) {
      reply.status(413);
      return { error: 'File too large. Max 20MB.' };
    }

    const assetId = randomUUID();
    const key = `uploads/${assetId}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
      })
    );

    const signedUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: config.s3.bucket,
        Key: key,
      }),
      { expiresIn: 3600 }
    );

    return { asset_id: assetId, signed_url: signedUrl };
  });
}
