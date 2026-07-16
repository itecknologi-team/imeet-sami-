import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL", "postgresql://user:password@localhost:5432/videoapp"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: process.env.JWT_SECRET ?? "change_this_secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  livekitUrl: required("LIVEKIT_URL", "ws://localhost:7880"),
  livekitApiKey: required("LIVEKIT_API_KEY", "devkey"),
  livekitApiSecret: required("LIVEKIT_API_SECRET"),
  s3Bucket: required("S3_BUCKET", "recordings"),
  s3AccessKey: required("S3_ACCESS_KEY"),
  s3SecretKey: required("S3_SECRET_KEY"),
  s3Endpoint: required("S3_ENDPOINT", "http://localhost:9000"),
  s3Region: process.env.S3_REGION ?? "us-east-1",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  recordingRetentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS ?? "30", 10),
  recordingCleanupIntervalMs: parseInt(process.env.RECORDING_CLEANUP_INTERVAL_MS ?? "3600000", 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};
