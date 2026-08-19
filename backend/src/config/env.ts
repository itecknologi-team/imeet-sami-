import "dotenv/config";
import path from "path";
import { existsSync, readFileSync } from "fs";

// Camera/mic access requires a secure context, and browsers don't treat a
// plain LAN IP over http as secure — so the *dev* setup runs everything
// (frontend, backend, LiveKit) over TLS using a shared mkcert-issued
// certificate. In production the app sits behind Caddy, which terminates real
// TLS for us: there is no certs/ directory there, so every use of it below is
// conditional. Reading these files unconditionally is what used to make the
// process crash on boot outside a dev checkout.
const certsDir = path.join(__dirname, "..", "..", "..", "certs");
const rootCaPath = path.join(certsDir, "rootCA.pem");
const tlsCertPath = path.join(certsDir, "imeet.pem");
const tlsKeyPath = path.join(certsDir, "imeet-key.pem");

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

if (existsSync(rootCaPath)) {
  // NODE_EXTRA_CA_CERTS must be set before this process makes its first TLS
  // connection for Node's legacy https/tls modules to trust the dev CA.
  process.env.NODE_EXTRA_CA_CERTS = rootCaPath;
  // NODE_EXTRA_CA_CERTS does NOT cover Node's built-in fetch (it runs on its
  // own undici dispatcher with its own cert handling) — livekit-server-sdk
  // uses fetch under the hood for its REST calls, so without this it fails
  // every request against the self-signed dev LiveKit endpoint with
  // UNABLE_TO_VERIFY_LEAF_SIGNATURE.
  //
  // Required lazily, not at module scope: undici is needed *only* for this dev
  // certificate path, and merely importing it crashes on a Node older than it
  // supports. Loading it unconditionally meant the production container died
  // at boot on an unrelated dependency it never actually uses.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Agent, setGlobalDispatcher } = require("undici") as typeof import("undici");
  setGlobalDispatcher(new Agent({ connect: { ca: readFileSync(rootCaPath) } }));
}

// Dev-only convenience fallbacks are deliberately NOT applied in production:
// silently booting prod against `postgres://user:password@localhost` or the
// well-known `devkey` LiveKit secret is worse than refusing to start.
function required(name: string, devFallback?: string): string {
  const value = process.env[name] ?? (isProduction ? undefined : devFallback);
  if (value === undefined || value === "") {
    throw new Error(
      `Missing required environment variable: ${name}` +
        (isProduction ? " (no development fallback is applied when NODE_ENV=production)" : ""),
    );
  }
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${raw}`);
  }
  return parsed;
}

export const env = {
  port: optionalInt("PORT", 4000),
  nodeEnv,
  isProduction,
  // Behind Caddy in production, TLS is terminated at the proxy and the app
  // speaks plain HTTP on the compose network. Locally, the mkcert pair is
  // used directly (see server.ts).
  tlsCertPath,
  tlsKeyPath,
  tlsEnabled: !isProduction && existsSync(tlsCertPath) && existsSync(tlsKeyPath),
  // Number of reverse proxies in front of the app. Required for correct
  // client IPs (and therefore correct rate limiting) behind Caddy.
  trustProxyHops: optionalInt("TRUST_PROXY_HOPS", isProduction ? 1 : 0),
  databaseUrl: required("DATABASE_URL", "postgresql://user:password@localhost:5442/videoapp"),
  redisUrl: required("REDIS_URL", "redis://localhost:6389"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  // Comma-separated list of origins allowed to call the API/socket server.
  // Left empty in development so the LAN-IP dev flow keeps working from any
  // device on the network without extra config; a production deploy must set
  // it explicitly (enforced below) rather than silently falling back to
  // wildcard CORS.
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  // Used by the server SDK (room admin, egress) — reachable on the internal
  // network, e.g. ws://livekit:7880 inside compose.
  livekitUrl: required("LIVEKIT_URL", "ws://localhost:7880"),
  // Handed to the browser in the join response. Behind a reverse proxy these
  // are two different URLs: the container address above isn't resolvable from
  // a participant's browser, and the public one isn't necessarily routable
  // from inside the network. Defaults to livekitUrl for the local stack, where
  // they genuinely are the same.
  livekitPublicUrl: process.env.LIVEKIT_PUBLIC_URL || required("LIVEKIT_URL", "ws://localhost:7880"),
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
  // Recordings live in a private bucket in production and are handed to the
  // browser as short-lived presigned URLs instead of permanent public links.
  s3PublicRead: (process.env.S3_PUBLIC_READ ?? String(!isProduction)) === "true",
  s3PresignTtlSeconds: optionalInt("S3_PRESIGN_TTL_SECONDS", 3600),
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  recordingRetentionDays: optionalInt("RECORDING_RETENTION_DAYS", 30),
  recordingCleanupIntervalMs: optionalInt("RECORDING_CLEANUP_INTERVAL_MS", 3_600_000),
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};

// The dev LiveKit credentials are committed to this repo (livekit.yaml,
// egress.yaml, .env.example) so the local stack works out of the box. That
// makes them public knowledge — anyone could mint a room token for any
// meeting — so production must not be allowed to inherit them.
const DEV_LIVEKIT_API_KEY = "devkey";
const DEV_LIVEKIT_API_SECRET = "54ff5680291ef292eed976456cbcb409bc59e4f46ded592ba33f2c5a0eafdd19";

if (isProduction) {
  const problems: string[] = [];

  if (env.allowedOrigins.length === 0) {
    problems.push("ALLOWED_ORIGINS must be set — refusing to start with wildcard-open CORS.");
  }
  if (env.jwtSecret.length < 32) {
    problems.push("JWT_SECRET must be at least 32 characters (generate with `openssl rand -hex 32`).");
  }
  if (env.livekitApiKey === DEV_LIVEKIT_API_KEY || env.livekitApiSecret === DEV_LIVEKIT_API_SECRET) {
    problems.push("LIVEKIT_API_KEY/LIVEKIT_API_SECRET are still the committed development values.");
  }
  if (env.s3AccessKey === "minioadmin" || env.s3SecretKey === "minioadmin123") {
    problems.push("S3_ACCESS_KEY/S3_SECRET_KEY are still the default MinIO credentials.");
  }
  if (env.s3PublicRead) {
    problems.push("S3_PUBLIC_READ must not be enabled in production — recordings would be world-readable.");
  }

  if (problems.length > 0) {
    throw new Error(`Refusing to start in production:\n  - ${problems.join("\n  - ")}`);
  }
}
