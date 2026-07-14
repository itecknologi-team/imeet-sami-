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
};
