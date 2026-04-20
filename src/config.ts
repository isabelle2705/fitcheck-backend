export interface Config {
  port: number;
  redisUrl: string;
  s3: {
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  replicateApiKey: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  clerkPublishableKey: string;
}

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config: Config = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  redisUrl: requireEnv('REDIS_URL'),
  s3: {
    region: requireEnv('AWS_REGION'),
    bucket: requireEnv('S3_BUCKET'),
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
  },
  replicateApiKey: requireEnv('REPLICATE_API_KEY'),
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  clerkPublishableKey: requireEnv('CLERK_PUBLISHABLE_KEY'),
};
