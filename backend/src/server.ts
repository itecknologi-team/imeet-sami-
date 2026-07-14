import { createServer } from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { initSocket } from "./realtime/socket";

const app = createApp();
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(env.port, () => {
  console.log(`Backend listening on port ${env.port}`);
});
