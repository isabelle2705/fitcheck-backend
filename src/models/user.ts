import { connection } from '../queue/queue.js';
import { config } from '../config.js';

export interface User {
  id: string;
  points: number;
  soulId?: string;
  createdAt: string;
}

function userKey(userId: string): string {
  return `user:${userId}`;
}

export async function createUser(userId: string): Promise<User> {
  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    points: config.starterPoints,
    createdAt: now,
  };

  const key = userKey(userId);
  await connection.hset(key, {
    id: userId,
    points: String(user.points),
    createdAt: now,
  });

  return user;
}

export async function getUser(userId: string): Promise<User | null> {
  const data = await connection.hgetall(userKey(userId));
  if (!data || !data['id']) return null;

  return {
    id: data['id'],
    points: parseInt(data['points'] ?? '0', 10),
    soulId: data['soulId'] ?? undefined,
    createdAt: data['createdAt'] ?? '',
  };
}

export async function setSoulId(userId: string, soulId: string): Promise<void> {
  await connection.hset(userKey(userId), 'soulId', soulId);
}

/**
 * Atomically deduct points. Returns success=false if balance would go negative.
 */
export async function deductPoints(
  userId: string,
  amount: number
): Promise<{ success: boolean; remaining: number }> {
  const key = userKey(userId);

  // Lua script for atomic check-and-deduct
  const script = `
    local current = tonumber(redis.call('HGET', KEYS[1], 'points'))
    if current == nil then return {-1, 0} end
    if current < tonumber(ARGV[1]) then return {0, current} end
    local newbal = current - tonumber(ARGV[1])
    redis.call('HSET', KEYS[1], 'points', tostring(newbal))
    return {1, newbal}
  `;

  const result = (await connection.eval(script, 1, key, String(amount))) as [number, number];
  const [code, remaining] = result;

  if (code === -1) {
    // user not found — treat as insufficient
    return { success: false, remaining: 0 };
  }

  return { success: code === 1, remaining };
}

export async function addPoints(userId: string, amount: number): Promise<number> {
  const key = userKey(userId);
  const newBalance = await connection.hincrby(key, 'points', amount);
  return newBalance;
}
