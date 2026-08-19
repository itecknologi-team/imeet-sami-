import { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";
import { Server as IOServer, Socket } from "socket.io";
import { env } from "../config/env";
import { registerMeetingEvents } from "./events";

let io: IOServer | undefined;

// Every realtime action used to take the actor's identity straight from the
// event payload, which meant a client could simply *say* it was the host and
// get host powers (kick participants, force-mute, rewrite host controls,
// auto-skip the waiting room). Any active participant id is discoverable from
// the public GET /api/meetings/:code/participants response, so this was a
// full meeting takeover for anyone holding a meeting code.
//
// Identity is now established once, here, at connection time and stored on
// the socket. Handlers read socket.data.userId only — the payload's own
// userId is ignored.
function resolveIdentity(socket: Socket): { userId: string; name: string } | null {
  const auth = (socket.handshake.auth ?? {}) as {
    token?: unknown;
    guestId?: unknown;
    name?: unknown;
  };
  const name = typeof auth.name === "string" && auth.name.trim() ? auth.name.trim().slice(0, 100) : "Guest";

  if (typeof auth.token === "string" && auth.token) {
    try {
      const payload = jwt.verify(auth.token, env.jwtSecret) as { id?: unknown };
      if (typeof payload.id === "string" && payload.id) {
        return { userId: payload.id, name };
      }
    } catch {
      // Fall through: an expired/invalid token is not silently upgraded to a
      // guest session, it's rejected below, so the client is forced to
      // refresh rather than continuing under a weaker identity.
      return null;
    }
  }

  // Guests have no account to authenticate against. Their guestId is already
  // the bearer capability for guest-host recovery in this app (see the
  // frontend's ?hostKey= flow), so presenting it is what proves the identity
  // — mirroring exactly what the REST layer accepts. It must at least be
  // well-formed and namespaced so it can never collide with a real user's
  // UUID and impersonate a signed-in host.
  if (typeof auth.guestId === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(auth.guestId)) {
    return { userId: `guest-${auth.guestId}`, name };
  }

  return null;
}

export function initSocket(httpServer: HTTPServer): IOServer {
  // Same origin policy as the REST API (see app.ts) — wildcard in
  // development for the LAN-IP test flow, explicit allowlist in production.
  io = new IOServer(httpServer, {
    cors: { origin: env.isProduction ? env.allowedOrigins : true },
    // Yjs code-editor updates and whiteboard batches are the largest frames
    // we legitimately send; anything beyond this is a memory-exhaustion
    // attempt rather than real traffic.
    maxHttpBufferSize: 1_000_000,
  });

  io.use((socket, next) => {
    const identity = resolveIdentity(socket);
    if (!identity) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.userId = identity.userId;
    socket.data.name = identity.name;
    next();
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
