import { Server as IOServer, Socket } from "socket.io";
import * as assistantService from "../modules/assistant/assistant.service";
import * as captionsService from "../modules/captions/captions.service";
import * as whiteboardService from "../modules/whiteboard/whiteboard.service";
import * as codeEditorService from "../modules/codeEditor/codeEditor.service";
import * as virtualOfficeService from "../modules/virtualOffice/virtualOffice.service";
import * as sharedViewService from "../modules/sharedView/sharedView.service";
import type { SharedView } from "../modules/sharedView/sharedView.service";
import * as waitingRoomService from "../modules/waitingRoom/waitingRoom.service";
import * as mediaControlService from "../modules/mediaControl/mediaControl.service";
import type { MediaKind } from "../modules/mediaControl/mediaControl.service";
import * as meetingsService from "../modules/meetings/meetings.service";
import * as handRaiseService from "../modules/handRaise/handRaise.service";
import * as pinService from "../modules/pin/pin.service";
import * as hostControlsService from "../modules/hostControls/hostControls.service";

// NOTE ON IDENTITY: none of these payloads carry the *actor's* own userId or
// name any more. The acting identity is established once at connection time
// (socket.ts verifies a JWT, or a namespaced guest capability) and read from
// socket.data here. Payloads still carry *target* ids (who to mute, who to
// kick) — those are authorization-checked against the actor, not trusted as
// the actor. Older clients may still send a `userId` field; it is ignored.

interface RoomPayload {
  meetingCode: string;
}

interface RespondJoinRequestPayload {
  meetingCode: string;
  requestId: string;
  approve: boolean;
}

interface HostSetMediaPayload {
  meetingCode: string;
  targetUserId: string;
  kind: MediaKind;
  blocked: boolean;
}

interface SendMessagePayload {
  meetingCode: string;
  text: string;
}

interface SendPrivateMessagePayload {
  meetingCode: string;
  targetUserId: string;
  text: string;
}

interface ToggleMutePayload {
  meetingCode: string;
  isMuted: boolean;
}

interface ToggleCameraPayload {
  meetingCode: string;
  isCameraOn: boolean;
}

interface AskAIPayload {
  meetingCode: string;
  question: string;
}

interface SetCaptionLanguagePayload {
  meetingCode: string;
  language: string;
}

interface WhiteboardStrokeStartPayload {
  meetingCode: string;
  strokeId: string;
  color: string;
  point: { x: number; y: number };
}

interface WhiteboardPointPayload {
  meetingCode: string;
  strokeId: string;
  point: { x: number; y: number };
}

interface CodeUpdatePayload {
  meetingCode: string;
  update: Uint8Array;
}

interface AvatarMovePayload {
  meetingCode: string;
  x: number;
  y: number;
}

interface SetActiveViewPayload {
  meetingCode: string;
  view: SharedView;
}

interface ToggleHandPayload {
  meetingCode: string;
  raised: boolean;
}

interface SendReactionPayload {
  meetingCode: string;
  emoji: string;
}

interface SetPinnedParticipantPayload {
  meetingCode: string;
  targetUserId: string | null;
}

interface KickParticipantPayload {
  meetingCode: string;
  targetUserId: string;
}

interface SetHostControlsPayload {
  meetingCode: string;
  settings: Partial<hostControlsService.HostControlSettings>;
}

interface SocketData {
  meetingCode?: string;
  userId?: string;
  name?: string;
  pendingRequestId?: string;
  admitted?: boolean;
}

// Text limits so a single socket can't push unbounded strings into the
// in-memory chat/assistant buffers (which are never trimmed by size).
const MAX_CHAT_TEXT = 4000;
const MAX_QUESTION_TEXT = 2000;

function sanitizeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

// Returns the acting identity only if this socket has actually been admitted
// into *this* meeting. Without the meetingCode comparison, a socket admitted
// to one meeting could emit events into any other meeting it names.
function actorIn(socket: Socket, meetingCode: string): string | null {
  const data = socket.data as SocketData;
  if (!data.admitted || !data.userId) return null;
  if (typeof meetingCode !== "string" || data.meetingCode !== meetingCode) return null;
  return data.userId;
}

async function requireHost(meetingCode: string, userId: string | undefined): Promise<boolean> {
  return meetingsService.isMeetingHost(meetingCode, userId ?? null).catch(() => false);
}

// The acting socket must be an admitted member of the meeting AND the host.
async function actingHost(socket: Socket, meetingCode: string): Promise<string | null> {
  const actor = actorIn(socket, meetingCode);
  if (!actor) return null;
  return (await requireHost(meetingCode, actor)) ? actor : null;
}

// Applies the media-affecting host-control toggles (own mic/camera,
// presenting) to everyone currently in the room, not just future joiners —
// used both right after the host flips a toggle and when a participant
// first joins under whatever's already in effect.
async function applyMediaControlDefaults(
  meetingCode: string,
  identity: string,
  settings: hostControlsService.HostControlSettings,
): Promise<Array<{ userId: string; kind: MediaKind; blocked: boolean }>> {
  const changes: Array<{ userId: string; kind: MediaKind; blocked: boolean }> = [];
  const kinds: Array<{ kind: MediaKind; allowed: boolean }> = [
    { kind: "microphone", allowed: settings.participantsCanControlOwnMedia },
    { kind: "camera", allowed: settings.participantsCanControlOwnMedia },
    { kind: "screen_share", allowed: settings.participantsCanPresent },
  ];
  for (const { kind, allowed } of kinds) {
    try {
      await mediaControlService.setBlocked(meetingCode, identity, kind, !allowed);
      changes.push({ userId: identity, kind, blocked: !allowed });
    } catch (err) {
      // A transient LiveKit API failure here must not take the whole
      // socket server down — same reasoning as host-set-media's own
      // try/catch below, just applied to a bulk/automatic path instead of
      // a single host-initiated one.
      console.error(`Failed to apply media default (${kind}) for ${identity} in ${meetingCode}:`, err);
    }
  }
  return changes;
}

export function registerMeetingEvents(io: IOServer, socket: Socket) {
  // Non-hosts are gated by a request-join handshake before they ever reach
  // join-room (see below) — the host is auto-approved so their own flow is
  // unaffected. join-room itself stays the point where a participant is
  // actually admitted into the room's realtime state.
  socket.on("join-room", async ({ meetingCode }: RoomPayload) => {
    const userId = (socket.data as SocketData).userId;
    const name = (socket.data as SocketData).name ?? "Guest";
    if (!userId || typeof meetingCode !== "string" || !meetingCode) return;

    // The REST join endpoint is where a meeting's passcode and paywall are
    // enforced, and it's what creates the participant row. Requiring that row
    // here means the realtime channel — chat, whiteboard, AI assistant, live
    // captions — can no longer be reached by skipping straight to the socket
    // and never passing those checks.
    const isMember = await meetingsService
      .isActiveParticipant(meetingCode, userId)
      .catch(() => false);
    if (!isMember) {
      // Distinct from "join-denied" (which means the host rejected a waiting
      // participant): this is reached only by a client that skipped the REST
      // join, so it needs its own signal rather than looking like a rejection.
      socket.emit("join-room-error", { error: "Not an active participant in this meeting" });
      return;
    }

    socket.data.meetingCode = meetingCode;
    socket.data.admitted = true;
    socket.join(meetingCode);
    socket.to(meetingCode).emit("user-joined", { userId, name });
    socket.emit("whiteboard-history", whiteboardService.getHistory(meetingCode));
    socket.emit("code-sync", codeEditorService.getStateAsUpdate(meetingCode));
    socket.emit("virtual-office-positions", virtualOfficeService.getPositions(meetingCode));
    socket.emit("active-view-changed", { view: sharedViewService.getView(meetingCode) });
    socket.emit("raised-hands-sync", handRaiseService.getRaised(meetingCode));
    socket.emit("pinned-participant-sync", { userId: pinService.getPinned(meetingCode) });

    const isHost = await requireHost(meetingCode, userId);
    const controls = hostControlsService.getSettings(meetingCode);
    socket.emit("host-controls-sync", { settings: controls });
    // A fresh non-host joiner starts out under whatever the host has
    // currently configured for self-service mic/camera/presenting — the
    // host's own media is never touched by these defaults.
    if (!isHost) {
      await applyMediaControlDefaults(meetingCode, userId, controls);
    }
    socket.emit("media-permissions-sync", mediaControlService.getRestrictions(meetingCode));
    // Visible to everyone (not just the host) since "who's waiting" is
    // exactly what a delegated participant needs to act on too.
    socket.emit("join-requests-sync", waitingRoomService.listRequests(meetingCode));
  });

  socket.on("leave-room", ({ meetingCode }: RoomPayload) => {
    const userId = actorIn(socket, meetingCode);
    if (!userId) return;

    socket.leave(meetingCode);
    socket.data.admitted = false;
    handRaiseService.setRaised(meetingCode, userId, false);
    socket.to(meetingCode).emit("hand-updated", { userId, raised: false });
    socket.to(meetingCode).emit("user-left", { userId, name: socket.data.name });
    if (pinService.getPinned(meetingCode) === userId) {
      pinService.setPinned(meetingCode, null);
      io.to(meetingCode).emit("pinned-participant-changed", { userId: null });
    }
    if (socket.data.pendingRequestId) {
      waitingRoomService.removeRequest(meetingCode, socket.data.pendingRequestId);
      io.to(meetingCode).emit("join-request-resolved", { requestId: socket.data.pendingRequestId });
      socket.data.pendingRequestId = undefined;
    }
  });

  // A guest's join is held here until the host approves — the host is
  // recognized server-side (isMeetingHost checks the DB against this
  // socket's authenticated identity, not a client-supplied one) and skipped
  // straight through so their own join never waits on anyone.
  socket.on("request-join", async ({ meetingCode }: RoomPayload) => {
    const userId = (socket.data as SocketData).userId;
    const name = (socket.data as SocketData).name ?? "Guest";
    if (!userId || typeof meetingCode !== "string" || !meetingCode) return;

    socket.data.meetingCode = meetingCode;

    if (await requireHost(meetingCode, userId)) {
      socket.emit("join-approved", { requestId: null });
      return;
    }

    const requestId = crypto.randomUUID();
    socket.data.pendingRequestId = requestId;
    waitingRoomService.addRequest(meetingCode, requestId, { userId, name, socketId: socket.id });
    io.to(meetingCode).emit("join-request", { requestId, userId, name });
  });

  socket.on("respond-join-request", async ({ meetingCode, requestId, approve }: RespondJoinRequestPayload) => {
    const actor = actorIn(socket, meetingCode);
    if (!actor) return;
    const isHost = await requireHost(meetingCode, actor);
    if (!isHost && !hostControlsService.getSettings(meetingCode).participantsCanAdmitOrRemove) return;

    const pending = waitingRoomService.getRequest(meetingCode, requestId);
    if (!pending) return;
    waitingRoomService.removeRequest(meetingCode, requestId);

    const targetSocket = io.sockets.sockets.get(pending.socketId);
    targetSocket?.emit(approve ? "join-approved" : "join-denied", { requestId });
    io.to(meetingCode).emit("join-request-resolved", { requestId });
  });

  // Force-mute/force-camera-off/block-screenshare — enforced through
  // LiveKit's own publish permissions (mediaControlService), not just a
  // client-trusted broadcast, so the target can't simply ignore it.
  socket.on("host-set-media", async ({ meetingCode, targetUserId, kind, blocked }: HostSetMediaPayload) => {
    const actor = actorIn(socket, meetingCode);
    if (!actor || typeof targetUserId !== "string" || !targetUserId) return;

    const isHost = await requireHost(meetingCode, actor);
    if (!isHost) {
      // Delegated "mute each other" only ever covers force-*muting* someone
      // else's mic — never unmuting them, never camera/screen-share, and
      // never aimed at the host, all of which stay host-only.
      const canMuteOthers =
        hostControlsService.getSettings(meetingCode).participantsCanMuteOthers &&
        kind === "microphone" &&
        blocked === true &&
        !(await requireHost(meetingCode, targetUserId));
      if (!canMuteOthers) return;
    }

    try {
      await mediaControlService.setBlocked(meetingCode, targetUserId, kind, blocked);
    } catch (err) {
      console.error(`Failed to ${blocked ? "block" : "allow"} ${kind} for ${targetUserId} in ${meetingCode}:`, err);
      return;
    }
    io.to(meetingCode).emit("media-permission-changed", { userId: targetUserId, kind, blocked });
  });

  socket.on("set-caption-language", ({ meetingCode, language }: SetCaptionLanguagePayload) => {
    const userId = actorIn(socket, meetingCode);
    if (!userId || typeof language !== "string") return;
    captionsService.setLanguage(meetingCode, userId, language.slice(0, 16));
  });

  socket.on("send-message", async ({ meetingCode, text }: SendMessagePayload) => {
    const userId = actorIn(socket, meetingCode);
    const body = sanitizeText(text, MAX_CHAT_TEXT);
    if (!userId || !body) return;
    const name = (socket.data as SocketData).name ?? "Guest";

    if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanChat) {
      return;
    }
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text: body,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text: body });
  });

  // Delivered only to the sender + the target's own socket(s) — never
  // broadcast room-wide and never appended to the AI assistant's buffer,
  // since that buffer is shared context for everyone in the meeting.
  socket.on(
    "send-private-message",
    async ({ meetingCode, targetUserId, text }: SendPrivateMessagePayload) => {
      const userId = actorIn(socket, meetingCode);
      const body = sanitizeText(text, MAX_CHAT_TEXT);
      if (!userId || !body || typeof targetUserId !== "string" || !targetUserId) return;
      const name = (socket.data as SocketData).name ?? "Guest";

      if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanChat) {
        return;
      }
      const payload = {
        userId,
        name,
        text: body,
        timestamp: new Date().toISOString(),
        toUserId: targetUserId,
        isPrivate: true,
      };
      socket.emit("new-message", payload);
      const room = io.sockets.adapter.rooms.get(meetingCode);
      if (!room) return;
      for (const socketId of room) {
        if (socketId === socket.id) continue;
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket?.data.userId === targetUserId) {
          targetSocket.emit("new-message", payload);
        }
      }
    },
  );

  socket.on("ask-ai", async ({ meetingCode, question }: AskAIPayload) => {
    const userId = actorIn(socket, meetingCode);
    const body = sanitizeText(question, MAX_QUESTION_TEXT);
    if (!userId || !body) return;
    const name = (socket.data as SocketData).name ?? "Guest";

    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text: body,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text: body });

    const requestId = crypto.randomUUID();
    io.to(meetingCode).emit("ai-response-start", { requestId });
    try {
      const fullText = await assistantService.streamAnswer(meetingCode, body, (delta) => {
        io.to(meetingCode).emit("ai-response-chunk", { requestId, delta });
      });
      assistantService.appendToBuffer(meetingCode, { name: "AI Assistant", text: fullText });
      io.to(meetingCode).emit("ai-response-end", { requestId });
    } catch (err) {
      console.error(`AI assistant failed for meeting ${meetingCode}:`, err);
      io.to(meetingCode).emit("ai-response-error", { requestId });
    }
  });

  // Whiteboard/code/virtual-office are host-only tools — everyone else may
  // still see whatever the host puts on screen (the shared-view broadcast
  // below), but can't switch into them or edit/move within them themselves.
  socket.on(
    "whiteboard-stroke-start",
    async ({ meetingCode, strokeId, color, point }: WhiteboardStrokeStartPayload) => {
      if (!(await actingHost(socket, meetingCode))) return;
      whiteboardService.startStroke(meetingCode, strokeId, color, point);
      socket.to(meetingCode).emit("whiteboard-stroke-start", { strokeId, color, point });
    },
  );

  socket.on("whiteboard-point", async ({ meetingCode, strokeId, point }: WhiteboardPointPayload) => {
    if (!(await actingHost(socket, meetingCode))) return;
    whiteboardService.addPoint(meetingCode, strokeId, point);
    socket.to(meetingCode).emit("whiteboard-point", { strokeId, point });
  });

  socket.on("whiteboard-clear", async ({ meetingCode }: RoomPayload) => {
    if (!(await actingHost(socket, meetingCode))) return;
    whiteboardService.clear(meetingCode);
    socket.to(meetingCode).emit("whiteboard-clear");
  });

  socket.on("code-update", async ({ meetingCode, update }: CodeUpdatePayload) => {
    if (!(await actingHost(socket, meetingCode))) return;
    codeEditorService.applyUpdate(meetingCode, update);
    socket.to(meetingCode).emit("code-update", update);
  });

  socket.on("avatar-move", async ({ meetingCode, x, y }: AvatarMovePayload) => {
    const userId = await actingHost(socket, meetingCode);
    if (!userId || typeof x !== "number" || typeof y !== "number") return;
    virtualOfficeService.setPosition(meetingCode, userId, x, y);
    socket.to(meetingCode).emit("avatar-moved", { userId, x, y });
  });

  // Whoever switches to Whiteboard/Code/Virtual Office brings everyone
  // else's screen along too — mirrors how a shared screen is inherently
  // visible to the whole room instead of being a private local tab. Only
  // the host may trigger the switch, though.
  socket.on("set-active-view", async ({ meetingCode, view }: SetActiveViewPayload) => {
    if (!(await actingHost(socket, meetingCode))) return;
    sharedViewService.setView(meetingCode, view);
    socket.to(meetingCode).emit("active-view-changed", { view });
  });

  // Host-driven spotlight — broadcast to the whole room (like the media
  // controls above), not a per-viewer local preference.
  socket.on("set-pinned-participant", async ({ meetingCode, targetUserId }: SetPinnedParticipantPayload) => {
    if (!(await actingHost(socket, meetingCode))) return;
    pinService.setPinned(meetingCode, targetUserId);
    io.to(meetingCode).emit("pinned-participant-changed", { userId: targetUserId });
  });

  // Ends both the socket session and the underlying LiveKit connection —
  // dropping only the socket would leave the kicked participant's audio/
  // video connected and visible to everyone until LiveKit's own timeout.
  socket.on("kick-participant", async ({ meetingCode, targetUserId }: KickParticipantPayload) => {
    const actor = actorIn(socket, meetingCode);
    if (!actor || typeof targetUserId !== "string" || !targetUserId) return;

    const isHost = await requireHost(meetingCode, actor);
    if (!isHost) {
      const canRemove = hostControlsService.getSettings(meetingCode).participantsCanAdmitOrRemove;
      // A delegated participant can never remove the actual host.
      if (!canRemove || (await requireHost(meetingCode, targetUserId))) return;
    }

    await mediaControlService.removeParticipant(meetingCode, targetUserId);

    const room = io.sockets.adapter.rooms.get(meetingCode);
    if (room) {
      for (const socketId of room) {
        const targetSocket = io.sockets.sockets.get(socketId);
        if (targetSocket?.data.userId === targetUserId) {
          targetSocket.emit("kicked");
          targetSocket.disconnect(true);
        }
      }
    }
    if (pinService.getPinned(meetingCode) === targetUserId) {
      pinService.setPinned(meetingCode, null);
      io.to(meetingCode).emit("pinned-participant-changed", { userId: null });
    }
  });

  socket.on("toggle-mute", ({ meetingCode, isMuted }: ToggleMutePayload) => {
    const userId = actorIn(socket, meetingCode);
    if (!userId) return;
    socket.to(meetingCode).emit("participant-updated", { userId, isMuted: Boolean(isMuted) });
  });

  socket.on("toggle-camera", ({ meetingCode, isCameraOn }: ToggleCameraPayload) => {
    const userId = actorIn(socket, meetingCode);
    if (!userId) return;
    socket.to(meetingCode).emit("participant-updated", { userId, isCameraOn: Boolean(isCameraOn) });
  });

  socket.on("toggle-hand", ({ meetingCode, raised }: ToggleHandPayload) => {
    const userId = actorIn(socket, meetingCode);
    if (!userId) return;
    handRaiseService.setRaised(meetingCode, userId, Boolean(raised));
    io.to(meetingCode).emit("hand-updated", { userId, raised: Boolean(raised) });
  });

  // Reactions are purely transient (a floating emoji burst) — relayed to
  // the whole room including the sender, with nothing persisted, unlike
  // raised hands which stay until lowered.
  socket.on("send-reaction", async ({ meetingCode, emoji }: SendReactionPayload) => {
    const userId = actorIn(socket, meetingCode);
    const symbol = sanitizeText(emoji, 16);
    if (!userId || !symbol) return;
    const name = (socket.data as SocketData).name ?? "Guest";

    if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanReact) {
      return;
    }
    io.to(meetingCode).emit("reaction", { userId, name, emoji: symbol });
  });

  // The host's single settings panel for delegating moderation/media powers
  // to everyone else in the meeting — every toggle here is off-by-default-safe
  // (see hostControls.service defaults) and re-checked on the specific event
  // it governs, not just here, so a stale client can't bypass a toggle that
  // was flipped back off after it cached the old value.
  socket.on("set-host-controls", async ({ meetingCode, settings: patch }: SetHostControlsPayload) => {
    if (!(await actingHost(socket, meetingCode))) return;

    const next = hostControlsService.updateSettings(meetingCode, patch);
    io.to(meetingCode).emit("host-controls-changed", { settings: next });

    if (patch.participantsCanControlOwnMedia === undefined && patch.participantsCanPresent === undefined) {
      return;
    }
    // Re-apply the new media defaults to everyone already in the room, not
    // just future joiners — a toggle should take effect immediately.
    const room = io.sockets.adapter.rooms.get(meetingCode);
    if (!room) return;
    for (const socketId of room) {
      const targetSocket = io.sockets.sockets.get(socketId);
      const identity = targetSocket?.data.userId;
      if (!identity || (await requireHost(meetingCode, identity))) continue;
      const changes = await applyMediaControlDefaults(meetingCode, identity, next);
      for (const change of changes) {
        io.to(meetingCode).emit("media-permission-changed", change);
      }
    }
  });

  socket.on("disconnect", () => {
    const { meetingCode, userId, name, pendingRequestId, admitted } = socket.data as SocketData;
    if (meetingCode && userId && admitted) {
      handRaiseService.setRaised(meetingCode, userId, false);
      socket.to(meetingCode).emit("hand-updated", { userId, raised: false });
      socket.to(meetingCode).emit("user-left", { userId, name });
      if (pinService.getPinned(meetingCode) === userId) {
        pinService.setPinned(meetingCode, null);
        io.to(meetingCode).emit("pinned-participant-changed", { userId: null });
      }
    }
    if (meetingCode && pendingRequestId) {
      waitingRoomService.removeRequest(meetingCode, pendingRequestId);
      io.to(meetingCode).emit("join-request-resolved", { requestId: pendingRequestId });
    }
  });
}
