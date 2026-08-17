import "dotenv/config";
import path from "path";
import { readFileSync } from "fs";
import { Agent, setGlobalDispatcher } from "undici";

// Camera/mic access requires a secure context, and browsers don't treat a
// plain LAN IP over http as secure — so this dev setup runs everything
// (frontend, backend, LiveKit) over TLS using a shared mkcert-issued
// certificate. NODE_EXTRA_CA_CERTS must be set before this process makes its
// first TLS connection for Node's legacy https/tls modules to trust that
// certificate's issuing CA.
const certsDir = path.join(__dirname, "..", "..", "..", "certs");
const rootCaPath = path.join(certsDir, "rootCA.pem");
process.env.NODE_EXTRA_CA_CERTS = rootCaPath;
// NODE_EXTRA_CA_CERTS above does NOT cover Node's built-in fetch (it runs on
// its own undici dispatcher with its own cert handling) — livekit-server-sdk
// uses fetch under the hood for its REST calls, so without this it fails
// every request against our self-signed LiveKit endpoint with
// UNABLE_TO_VERIFY_LEAF_SIGNATURE.
setGlobalDispatcher(new Agent({ connect: { ca: readFileSync(rootCaPath) } }));

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  tlsCertPath: path.join(certsDir, "imeet.pem"),
  tlsKeyPath: path.join(certsDir, "imeet-key.pem"),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL", "postgresql://user:password@localhost:5432/videoapp"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  // Comma-separated list of origins allowed to call the API/socket server.
  // Left empty in development so the LAN-IP dev flow (see LIVEKIT_URL above)
  // keeps working from any device on the network without extra config; a
  // production deploy must set this explicitly (enforced below) rather than
  // silently falling back to wildcard CORS.
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  livekitUrl: required("LIVEKIT_URL", "ws://localhost:7880"),
  livekitApiKey: required("LIVEKIT_API_KEY", "devkey"),
  livekitApiSecret: required("LIVEKIT_API_SECRET"),
  s3Bucket: required("S3_BUCKET", "recordings"),
  s3AccessKey: required("S3_ACCESS_KEY"),
  s3SecretKey: required("S3_SECRET_KEY"),
  s3Endpoint: required("S3_ENDPOINT", "http://localhost:9000"),
  // Reachable from the egress container (docker-compose network), unlike
  // s3Endpoint above which is host-facing.
  s3EgressEndpoint: process.env.S3_EGRESS_ENDPOINT ?? "http://minio:9000",
  s3Region: process.env.S3_REGION ?? "us-east-1",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  recordingRetentionDays: parseInt(process.env.RECORDING_RETENTION_DAYS ?? "30", 10),
  recordingCleanupIntervalMs: parseInt(process.env.RECORDING_CLEANUP_INTERVAL_MS ?? "3600000", 10),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};

if (env.nodeEnv === "production" && env.allowedOrigins.length === 0) {
  throw new Error(
    "ALLOWED_ORIGINS must be set in production — refusing to start with wildcard-open CORS.",
  );
}
