import { Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";
import { registerMeetingEvents } from "./events";

let io: IOServer | undefined;

export function initSocket(httpServer: HTTPServer): IOServer {
  io = new IOServer(httpServer, { cors: { origin: "*" } });
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
