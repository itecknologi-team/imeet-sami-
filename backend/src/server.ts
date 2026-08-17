import { readFileSync } from "fs";
import { createServer } from "https";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocket } from "./realtime/socket";
import * as recordingsService from "./modules/recordings/recordings.service";

const app = createApp();
const httpServer = createServer(
  { cert: readFileSync(env.tlsCertPath), key: readFileSync(env.tlsKeyPath) },
  app,
);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});

setInterval(() => {
  recordingsService.cleanupExpiredRecordings().catch((err) => {
    console.error("Recording cleanup job failed:", err);
  });
}, env.recordingCleanupIntervalMs);
