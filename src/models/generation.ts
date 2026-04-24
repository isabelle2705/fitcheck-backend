import { connection } from '../queue/queue.js';

export interface Generation {
  id: string;
  userId: string;
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  garmentIds: string[];
  soulId: string;
  createdAt: string;
  brandPaid?: boolean;
}

function genKey(id: string): string {
  return `gen:${id}`;
}

function feedKey(userId: string): string {
  return `user_feed:${userId}`;
}

function serializeGeneration(gen: Generation): Record<string, string> {
  const record: Record<string, string> = {
    id: gen.id,
    userId: gen.userId,
    jobId: gen.jobId,
    status: gen.status,
    garmentIds: JSON.stringify(gen.garmentIds),
    soulId: gen.soulId,
    createdAt: gen.createdAt,
  };
  if (gen.resultUrl !== undefined) record['resultUrl'] = gen.resultUrl;
  if (gen.brandPaid !== undefined) record['brandPaid'] = gen.brandPaid ? '1' : '0';
  return record;
}

function deserializeGeneration(data: Record<string, string>): Generation {
  return {
    id: data['id'] ?? '',
    userId: data['userId'] ?? '',
    jobId: data['jobId'] ?? '',
    status: (data['status'] as Generation['status']) ?? 'processing',
    resultUrl: data['resultUrl'] ?? undefined,
    garmentIds: data['garmentIds'] ? (JSON.parse(data['garmentIds']) as string[]) : [],
    soulId: data['soulId'] ?? '',
    createdAt: data['createdAt'] ?? '',
    brandPaid: data['brandPaid'] === '1' ? true : data['brandPaid'] === '0' ? false : undefined,
  };
}

export async function saveGeneration(gen: Generation): Promise<void> {
  const key = genKey(gen.id);
  await connection.hset(key, serializeGeneration(gen));
  // Prepend to feed list (newest first)
  await connection.lpush(feedKey(gen.userId), gen.id);
}

export async function getUserFeed(userId: string, limit = 50): Promise<Generation[]> {
  const ids = await connection.lrange(feedKey(userId), 0, limit - 1);
  if (ids.length === 0) return [];

  const pipeline = connection.pipeline();
  for (const id of ids) {
    pipeline.hgetall(genKey(id));
  }
  const results = await pipeline.exec();
  if (!results) return [];

  const generations: Generation[] = [];
  for (const [err, data] of results) {
    if (err || !data) continue;
    const record = data as Record<string, string>;
    if (record['id']) {
      generations.push(deserializeGeneration(record));
    }
  }
  return generations;
}

export async function updateGeneration(id: string, updates: Partial<Generation>): Promise<void> {
  const key = genKey(id);
  const patch: Record<string, string> = {};

  if (updates.status !== undefined) patch['status'] = updates.status;
  if (updates.resultUrl !== undefined) patch['resultUrl'] = updates.resultUrl;
  if (updates.brandPaid !== undefined) patch['brandPaid'] = updates.brandPaid ? '1' : '0';
  if (updates.jobId !== undefined) patch['jobId'] = updates.jobId;

  if (Object.keys(patch).length > 0) {
    await connection.hset(key, patch);
  }
}

export async function getGeneration(id: string): Promise<Generation | null> {
  const data = await connection.hgetall(genKey(id));
  if (!data || !data['id']) return null;
  return deserializeGeneration(data);
}
