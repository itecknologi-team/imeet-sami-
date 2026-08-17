import { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import { env } from "../config/env";
import { registerMeetingEvents } from "./events";

let io: IOServer | undefined;

export function initSocket(httpServer: HTTPServer): IOServer {
  // Same origin policy as the REST API (see app.ts) — wildcard in
  // development for the LAN-IP test flow, explicit allowlist in production.
  io = new IOServer(httpServer, {
    cors: { origin: env.nodeEnv === "production" ? env.allowedOrigins : true },
  });
  io.on("connection", (socket) => {
    registerMeetingEvents(io!, socket);
  });
  return io;
}

export function getIO(): IOServer {
  if (!io) {
    throw new Error("Socket.io server has not been initialized");
  }
  return io;
}
