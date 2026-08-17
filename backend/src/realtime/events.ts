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

interface JoinRoomPayload {
  meetingCode: string;
  userId: string;
  name: string;
}

interface LeaveRoomPayload {
  meetingCode: string;
  userId: string;
}

interface RequestJoinPayload {
  meetingCode: string;
  userId: string;
  name: string;
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
  userId: string;
  name: string;
  text: string;
}

interface SendPrivateMessagePayload {
  meetingCode: string;
  userId: string;
  name: string;
  targetUserId: string;
  text: string;
}

interface ToggleMutePayload {
  meetingCode: string;
  userId: string;
  isMuted: boolean;
}

interface ToggleCameraPayload {
  meetingCode: string;
  userId: string;
  isCameraOn: boolean;
}

interface AskAIPayload {
  meetingCode: string;
  userId: string;
  name: string;
  question: string;
}

interface SetCaptionLanguagePayload {
  meetingCode: string;
  userId: string;
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

interface WhiteboardClearPayload {
  meetingCode: string;
}

interface CodeUpdatePayload {
  meetingCode: string;
  update: Uint8Array;
}

interface AvatarMovePayload {
  meetingCode: string;
  userId: string;
  x: number;
  y: number;
}

interface SetActiveViewPayload {
  meetingCode: string;
  view: SharedView;
}

interface ToggleHandPayload {
  meetingCode: string;
  userId: string;
  raised: boolean;
}

interface SendReactionPayload {
  meetingCode: string;
  userId: string;
  name: string;
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
}

async function requireHost(meetingCode: string, userId: string | undefined): Promise<boolean> {
  return meetingsService.isMeetingHost(meetingCode, userId ?? null).catch(() => false);
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
  socket.on("join-room", async ({ meetingCode, userId, name }: JoinRoomPayload) => {
    socket.data.meetingCode = meetingCode;
    socket.data.userId = userId;
    socket.data.name = name;
    socket.join(meetingCode);
    socket.to(meetingCode).emit("user-joined", { userId, name });
    socket.emit("whiteboard-history", whiteboardService.getHistory(meetingCode));
    socket.emit("code-sync", codeEditorService.getStateAsUpdate(meetingCode));
    socket.emit("virtual-office-positions", virtualOfficeService.getPositions(meetingCode));
    socket.emit("active-view-changed", { view: sharedViewService.getView(meetingCode) });
    socket.emit("raised-hands-sync", handRaiseService.getRaised(meetingCode));
    socket.emit("pinned-participant-sync", { userId: pinService.getPinned(meetingCode) });

    const isHost = await meetingsService.isMeetingHost(meetingCode, userId).catch(() => false);
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

  socket.on("leave-room", ({ meetingCode, userId }: LeaveRoomPayload) => {
    socket.leave(meetingCode);
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
  // recognized server-side (isMeetingHost checks the DB, not a
  // client-supplied flag) and skipped straight through so their own join
  // never waits on anyone.
  socket.on("request-join", async ({ meetingCode, userId, name }: RequestJoinPayload) => {
    socket.data.meetingCode = meetingCode;
    socket.data.userId = userId;
    socket.data.name = name;

    const isHost = await meetingsService.isMeetingHost(meetingCode, userId).catch(() => false);
    if (isHost) {
      socket.emit("join-approved", { requestId: null });
      return;
    }

    const requestId = crypto.randomUUID();
    socket.data.pendingRequestId = requestId;
    waitingRoomService.addRequest(meetingCode, requestId, { userId, name, socketId: socket.id });
    io.to(meetingCode).emit("join-request", { requestId, userId, name });
  });

  socket.on("respond-join-request", async ({ meetingCode, requestId, approve }: RespondJoinRequestPayload) => {
    const isHost = await requireHost(meetingCode, socket.data.userId);
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
    const isHost = await requireHost(meetingCode, socket.data.userId);
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

  socket.on("set-caption-language", ({ meetingCode, userId, language }: SetCaptionLanguagePayload) => {
    captionsService.setLanguage(meetingCode, userId, language);
  });

  socket.on("send-message", async ({ meetingCode, userId, name, text }: SendMessagePayload) => {
    if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanChat) {
      return;
    }
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text });
  });

  // Delivered only to the sender + the target's own socket(s) — never
  // broadcast room-wide and never appended to the AI assistant's buffer,
  // since that buffer is shared context for everyone in the meeting.
  socket.on(
    "send-private-message",
    async ({ meetingCode, userId, name, targetUserId, text }: SendPrivateMessagePayload) => {
      if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanChat) {
        return;
      }
      const payload = {
        userId,
        name,
        text,
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

  socket.on("ask-ai", async ({ meetingCode, userId, name, question }: AskAIPayload) => {
    io.to(meetingCode).emit("new-message", {
      userId,
      name,
      text: question,
      timestamp: new Date().toISOString(),
    });
    assistantService.appendToBuffer(meetingCode, { name, text: question });

    const requestId = crypto.randomUUID();
    io.to(meetingCode).emit("ai-response-start", { requestId });
    try {
      const fullText = await assistantService.streamAnswer(meetingCode, question, (delta) => {
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
      if (!(await requireHost(meetingCode, socket.data.userId))) return;
      whiteboardService.startStroke(meetingCode, strokeId, color, point);
      socket.to(meetingCode).emit("whiteboard-stroke-start", { strokeId, color, point });
    },
  );

  socket.on("whiteboard-point", async ({ meetingCode, strokeId, point }: WhiteboardPointPayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    whiteboardService.addPoint(meetingCode, strokeId, point);
    socket.to(meetingCode).emit("whiteboard-point", { strokeId, point });
  });

  socket.on("whiteboard-clear", async ({ meetingCode }: WhiteboardClearPayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    whiteboardService.clear(meetingCode);
    socket.to(meetingCode).emit("whiteboard-clear");
  });

  socket.on("code-update", async ({ meetingCode, update }: CodeUpdatePayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    codeEditorService.applyUpdate(meetingCode, update);
    socket.to(meetingCode).emit("code-update", update);
  });

  socket.on("avatar-move", async ({ meetingCode, userId, x, y }: AvatarMovePayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    virtualOfficeService.setPosition(meetingCode, userId, x, y);
    socket.to(meetingCode).emit("avatar-moved", { userId, x, y });
  });

  // Whoever switches to Whiteboard/Code/Virtual Office brings everyone
  // else's screen along too — mirrors how a shared screen is inherently
  // visible to the whole room instead of being a private local tab. Only
  // the host may trigger the switch, though.
  socket.on("set-active-view", async ({ meetingCode, view }: SetActiveViewPayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    sharedViewService.setView(meetingCode, view);
    socket.to(meetingCode).emit("active-view-changed", { view });
  });

  // Host-driven spotlight — broadcast to the whole room (like the media
  // controls above), not a per-viewer local preference.
  socket.on("set-pinned-participant", async ({ meetingCode, targetUserId }: SetPinnedParticipantPayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;
    pinService.setPinned(meetingCode, targetUserId);
    io.to(meetingCode).emit("pinned-participant-changed", { userId: targetUserId });
  });

  // Ends both the socket session and the underlying LiveKit connection —
  // dropping only the socket would leave the kicked participant's audio/
  // video connected and visible to everyone until LiveKit's own timeout.
  socket.on("kick-participant", async ({ meetingCode, targetUserId }: KickParticipantPayload) => {
    const isHost = await requireHost(meetingCode, socket.data.userId);
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

  socket.on("toggle-mute", ({ meetingCode, userId, isMuted }: ToggleMutePayload) => {
    socket.to(meetingCode).emit("participant-updated", { userId, isMuted });
  });

  socket.on("toggle-camera", ({ meetingCode, userId, isCameraOn }: ToggleCameraPayload) => {
    socket.to(meetingCode).emit("participant-updated", { userId, isCameraOn });
  });

  socket.on("toggle-hand", ({ meetingCode, userId, raised }: ToggleHandPayload) => {
    handRaiseService.setRaised(meetingCode, userId, raised);
    io.to(meetingCode).emit("hand-updated", { userId, raised });
  });

  // Reactions are purely transient (a floating emoji burst) — relayed to
  // the whole room including the sender, with nothing persisted, unlike
  // raised hands which stay until lowered.
  socket.on("send-reaction", async ({ meetingCode, userId, name, emoji }: SendReactionPayload) => {
    if (!(await requireHost(meetingCode, userId)) && !hostControlsService.getSettings(meetingCode).participantsCanReact) {
      return;
    }
    io.to(meetingCode).emit("reaction", { userId, name, emoji });
  });

  // The host's single settings panel for delegating moderation/media powers
  // to everyone else in the meeting — every toggle here is off-by-default-safe
  // (see hostControls.service defaults) and re-checked on the specific event
  // it governs, not just here, so a stale client can't bypass a toggle that
  // was flipped back off after it cached the old value.
  socket.on("set-host-controls", async ({ meetingCode, settings: patch }: SetHostControlsPayload) => {
    if (!(await requireHost(meetingCode, socket.data.userId))) return;

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
    const { meetingCode, userId, name, pendingRequestId } = socket.data as SocketData;
    if (meetingCode && userId) {
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
