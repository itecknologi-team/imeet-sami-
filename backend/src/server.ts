import { readFileSync } from "fs";
import { createServer as createHttpServer, Server } from "http";
import { createServer as createHttpsServer } from "https";
import { createApp } from "./app";
import { pool } from "./config/db";
import { env } from "./config/env";
import { initSocket } from "./realtime/socket";
import * as recordingsService from "./modules/recordings/recordings.service";

const app = createApp();

// In development the app terminates TLS itself with the shared mkcert pair
// (browsers refuse camera/mic access to a plain-http LAN origin). In
// production Caddy terminates real TLS in front of us and forwards plain HTTP
// over the internal network, so binding https here would only break the
// proxy — and would require certificate files that don't exist on the server.
const httpServer: Server = env.tlsEnabled
  ? (createHttpsServer(
      { cert: readFileSync(env.tlsCertPath), key: readFileSync(env.tlsKeyPath) },
      app,
    ) as unknown as Server)
  : createHttpServer(app);

const io = initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(
    `Backend listening on port ${env.port} (${env.tlsEnabled ? "https" : "http"}, NODE_ENV=${env.nodeEnv})`,
  );
});

const cleanupTimer = setInterval(() => {
  recordingsService.cleanupExpiredRecordings().catch((err) => {
    console.error("Recording cleanup job failed:", err);
  });
}, env.recordingCleanupIntervalMs);

// Every redeploy sends SIGTERM. Without this, in-flight HTTP requests are cut
// mid-response and open sockets are dropped without a close frame, so clients
// see a hard error instead of reconnecting cleanly.
let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal} — shutting down gracefully`);

  clearInterval(cleanupTimer);
  const forceExit = setTimeout(() => {
    console.error("Graceful shutdown timed out after 15s — exiting");
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    // io.close() disconnects every socket AND closes the HTTP server it was
    // attached to, so closing httpServer separately afterwards would throw
    // ERR_SERVER_NOT_RUNNING and turn a clean shutdown into a failed one.
    await new Promise<void>((resolve, reject) => {
      io.close((err) => (err ? reject(err) : resolve()));
    });
    await pool.end();
    console.log("Shutdown complete");
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

// An unhandled rejection leaves the process in an undefined state; log loudly
// and let the container restart policy replace it rather than limping on.
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
  void shutdown("uncaughtException");
});
