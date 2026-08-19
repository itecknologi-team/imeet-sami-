import { io, Socket } from "socket.io-client";
import { API_BASE_URL } from "./api";

export interface MeetingSocketIdentity {
  /** Access token for a signed-in user. */
  accessToken?: string | null;
  /** Stable per-browser id for a guest (see lib/guestId.ts). */
  guestId?: string | null;
  /** Display name, used for join requests and chat attribution. */
  name?: string | null;
}

// The server establishes who this connection is exactly once, from these
// handshake credentials, and ignores any identity sent in later event payloads
// — so an unauthenticated socket can no longer claim to be the host. A
// connection presenting neither a valid token nor a guest id is rejected.
export function createMeetingSocket(identity: MeetingSocketIdentity): Socket {
  // API_BASE_URL is deliberately empty in the same-origin production setup
  // (see api.ts); socket.io needs a real URL, so resolve it explicitly here.
  return io(API_BASE_URL || window.location.origin, {
    transports: ["websocket"],
    auth: {
      token: identity.accessToken ?? undefined,
      guestId: identity.guestId ?? undefined,
      name: identity.name ?? undefined,
    },
  });
}
