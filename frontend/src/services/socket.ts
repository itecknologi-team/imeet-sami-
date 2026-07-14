import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

export function createMeetingSocket(): Socket {
  return io(API_BASE_URL, { transports: ["websocket"] });
}
