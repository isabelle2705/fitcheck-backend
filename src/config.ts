export interface Config {
  port: number;
  redisUrl: string;
  mockMode: boolean;
  higgsfield: {
    apiKey: string;
  };
  r2: {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    publicUrl: string;
  };
  anthropicApiKey: string;
  starterPoints: number;
  pointsPerGeneration: number;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalEnv(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? '3001', 10),
  redisUrl: requireEnv('REDIS_URL'),
  mockMode: optionalEnv('MOCK_MODE', 'false') === 'true',
  higgsfield: {
    apiKey: optionalEnv('HIGGSFIELD_API_KEY'),
  },
  r2: {
    accountId: optionalEnv('R2_ACCOUNT_ID'),
    accessKeyId: optionalEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: optionalEnv('R2_SECRET_ACCESS_KEY'),
    bucket: optionalEnv('R2_BUCKET_NAME', 'fitcheck-images'),
    publicUrl: optionalEnv('R2_PUBLIC_URL'),
  },
  anthropicApiKey: optionalEnv('ANTHROPIC_API_KEY'),
  starterPoints: parseInt(optionalEnv('STARTER_POINTS', '100'), 10),
  pointsPerGeneration: parseInt(optionalEnv('POINTS_PER_GENERATION', '10'), 10),
};
