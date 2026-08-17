import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  ExternalE2EEKeyProvider,
  isE2EESupported,
  VideoPresets,
} from "livekit-client";
import type {
  ConnectionQuality,
  LocalTrackPublication,
  RemoteTrackPublication,
  Participant,
} from "livekit-client";
import type { Socket } from "socket.io-client";
import * as Y from "yjs";
import * as api from "../services/api";
import { createMeetingSocket } from "../services/socket";
import { generateId } from "../lib/uuid";
import type { ActiveView } from "../lib/meetingViews";

export interface WhiteboardPoint {
  x: number;
  y: number;
}

export interface WhiteboardStroke {
  id: string;
  color: string;
  points: WhiteboardPoint[];
}

export interface AvatarPosition {
  x: number;
  y: number;
}

export const VIRTUAL_OFFICE_DEFAULT_POSITION: AvatarPosition = { x: 450, y: 280 };
// How close (in floor units) two avatars need to be before they can hear
// each other at all — shared by MeetingRoomPage's spatial-audio gain/pan
// math and VirtualOfficePanel's on-screen hearing-range ring, so the ring
// drawn around your avatar always matches what you can actually hear.
export const VIRTUAL_OFFICE_HEARING_RADIUS = 300;

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  timestamp: string;
  isAI?: boolean;
  requestId?: string;
  streaming?: boolean;
  toUserId?: string;
  isPrivate?: boolean;
}

export interface CaptionEntry {
  id: string;
  userId: string;
  name: string;
  sourceText: string;
  translations: Record<string, string>;
  timestamp: string;
}

export interface MeetingParticipantInfo {
  userId: string;
  name: string;
  role: string;
  joinedAt: string;
}

export type MediaKind = "microphone" | "camera" | "screen_share";

export interface JoinRequestEntry {
  requestId: string;
  userId: string;
  name: string;
}

export interface NotificationEntry {
  id: string;
  text: string;
}

export interface ReactionEntry {
  id: string;
  userId: string;
  name: string;
  emoji: string;
  offset: number;
}

export interface HostControlSettings {
  participantsCanAdmitOrRemove: boolean;
  participantsCanMuteOthers: boolean;
  participantsCanControlOwnMedia: boolean;
  participantsCanPresent: boolean;
  participantsCanChat: boolean;
  participantsCanReact: boolean;
}

// Mirrors the backend's default (hostControls.service.ts) so the UI reads
// correctly for the brief window before the server's own sync arrives.
const DEFAULT_HOST_CONTROLS: HostControlSettings = {
  participantsCanAdmitOrRemove: false,
  participantsCanMuteOthers: false,
  participantsCanControlOwnMedia: true,
  participantsCanPresent: true,
  participantsCanChat: true,
  participantsCanReact: true,
};

interface CurrentUser {
  id: string;
  name: string;
}

// Re-enabling the camera/mic right after a host unblock races LiveKit's own
// permission propagation: the app server's updateParticipant call can
// resolve before the widened grant actually reaches the SFU node handling
// this participant's session, so the very next publish attempt gets
// rejected even though the unblock was genuine. A few short retries absorb
// that propagation delay instead of the UI silently keeping a "camera on"
// state for a track that never actually got published.
async function withRetries(action: () => Promise<unknown>, attempts = 4, baseDelayMs = 350): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await action();
      return true;
    } catch {
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
      }
    }
  }
  return false;
}

export function useMeeting(
  meetingCode: string,
  accessToken: string | null,
  currentUser: CurrentUser | null,
  guestId: string | null = null,
  passcode?: string,
  shouldJoin: boolean = true,
  initialMicEnabled: boolean = true,
  initialCameraEnabled: boolean = true,
  preAcquiredStream: MediaStream | null = null,
) {
  const [keyProvider] = useState(() => new ExternalE2EEKeyProvider());
  const [room] = useState(() => {
    const worker = new Worker(new URL("livekit-client/e2ee-worker", import.meta.url), { type: "module" });
    return new Room({
      e2ee: { keyProvider, worker },
      // Without these, every remote tile subscribes at full camera
      // resolution/bitrate all the time regardless of tile size or whether
      // it's even on-screen — adaptiveStream drops subscribed resolution
      // for small/hidden tiles, dynacast stops the publisher from even
      // encoding simulcast layers nobody's currently subscribed to.
      adaptiveStream: true,
      dynacast: true,
      publishDefaults: {
        simulcast: true,
        videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
        // Opus DTX/RED: stop sending audio packets during silence, and add
        // redundant encoding so brief packet loss doesn't clip speech —
        // meaningful quality wins on lossy/mobile networks at near-zero cost.
        dtx: true,
        red: true,
      },
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });
  });
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [participants, setParticipants] = useState<MeetingParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(!initialMicEnabled);
  const [isCameraOn, setIsCameraOn] = useState(initialCameraEnabled);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareParticipantIdentity, setScreenShareParticipantIdentity] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartedAt, setRecordingStartedAt] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [activeView, setActiveViewState] = useState<ActiveView>("video");
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [finalCost, setFinalCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paymentRequired, setPaymentRequired] = useState<{ priceCents: number; currency: string } | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLanguage, setCaptionLanguageState] = useState("en");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [ydoc] = useState(() => new Y.Doc());
  const [audioContext] = useState(() => new AudioContext());
  const [avatarPositions, setAvatarPositions] = useState<Record<string, AvatarPosition>>({});
  const [myAvatarPosition, setMyAvatarPosition] = useState<AvatarPosition>(VIRTUAL_OFFICE_DEFAULT_POSITION);
  const [waitingForApproval, setWaitingForApproval] = useState(false);
  const [joinDenied, setJoinDenied] = useState(false);
  const [joinRequests, setJoinRequests] = useState<JoinRequestEntry[]>([]);
  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [mediaRestrictions, setMediaRestrictions] = useState<Record<string, MediaKind[]>>({});
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [reactions, setReactions] = useState<ReactionEntry[]>([]);
  const [pinnedUserId, setPinnedUserIdState] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [hostControls, setHostControls] = useState<HostControlSettings>(DEFAULT_HOST_CONTROLS);
  const whiteboardHistoryRef = useRef<WhiteboardStroke[]>([]);
  const socketRef = useRef<Socket | null>(null);

  const pushNotification = useCallback((text: string) => {
    const id = generateId();
    setNotifications((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 5000);
  }, []);

  useEffect(() => {
    if (!currentUser || !shouldJoin) {
      return;
    }
    const user = currentUser;
    let cancelled = false;

    function handleParticipantConnected(participant: RemoteParticipant) {
      setRemoteParticipants((prev) => [...prev, participant]);
    }
    function handleParticipantDisconnected(participant: RemoteParticipant) {
      setRemoteParticipants((prev) => prev.filter((p) => p.identity !== participant.identity));
    }
    function handleTrackPublished(
      publication: RemoteTrackPublication | LocalTrackPublication,
      participant: Participant,
    ) {
      if (publication.source === Track.Source.ScreenShare) {
        setScreenShareParticipantIdentity(participant.identity);
      }
    }
    function handleTrackUnpublished(
      publication: RemoteTrackPublication | LocalTrackPublication,
      participant: Participant,
    ) {
      if (publication.source === Track.Source.ScreenShare) {
        setScreenShareParticipantIdentity((prev) => (prev === participant.identity ? null : prev));
        if (participant.identity === room.localParticipant.identity) {
          setIsScreenSharing(false);
        }
      }
    }
    function handleEncryptionStatusChanged(enabled: boolean, participant?: Participant) {
      if (participant?.identity === room.localParticipant.identity) {
        setIsE2EEEnabled(enabled);
      }
    }
    function handleConnectionQualityChanged(quality: ConnectionQuality, participant: Participant) {
      if (participant.identity === room.localParticipant.identity) {
        setConnectionQuality(quality);
      }
    }
    function handleReconnecting() {
      pushNotification("Connection lost — reconnecting...");
    }
    function handleReconnected() {
      pushNotification("Reconnected");
      // livekit-client republishes previously-active local tracks itself on
      // reconnect, but the SFU-side permission grant it re-applies against
      // can lag the same way it does on a live unblock (see
      // media-permission-changed above) — so re-assert once, with retries,
      // rather than trusting that republish to have actually landed.
      withRetries(() => room.localParticipant.setMicrophoneEnabled(room.localParticipant.isMicrophoneEnabled), 3, 300);
      withRetries(() => room.localParticipant.setCameraEnabled(room.localParticipant.isCameraEnabled), 3, 300);
    }
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.ParticipantEncryptionStatusChanged, handleEncryptionStatusChanged);
    room.on(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
    room.on(RoomEvent.Reconnecting, handleReconnecting);
    room.on(RoomEvent.Reconnected, handleReconnected);

    async function setup() {
      try {
        const returningSessionId = accessToken
          ? new URLSearchParams(window.location.search).get("session_id")
          : null;
        if (returningSessionId) {
          await api.confirmPayment(accessToken!, meetingCode, returningSessionId).catch((err) => {
            console.error("Payment confirmation failed:", err);
          });
          window.history.replaceState({}, "", window.location.pathname);
        }

        // The host is auto-approved server-side (isMeetingHost checks the
        // DB), so this handshake is a no-op delay for them — everyone else
        // waits here until the host responds via respond-join-request.
        const handshakeSocket = createMeetingSocket();
        socketRef.current = handshakeSocket;
        setSocket(handshakeSocket);
        setWaitingForApproval(true);
        handshakeSocket.emit("request-join", { meetingCode, userId: user.id, name: user.name });
        const approved = await new Promise<boolean>((resolve) => {
          function onApproved() {
            cleanup();
            resolve(true);
          }
          function onDenied() {
            cleanup();
            resolve(false);
          }
          function cleanup() {
            handshakeSocket.off("join-approved", onApproved);
            handshakeSocket.off("join-denied", onDenied);
          }
          handshakeSocket.on("join-approved", onApproved);
          handshakeSocket.on("join-denied", onDenied);
        });
        if (cancelled) return;
        setWaitingForApproval(false);
        if (!approved) {
          setJoinDenied(true);
          return;
        }

        const joinResp = await api.joinMeeting(
          accessToken,
          meetingCode,
          accessToken ? undefined : { guestId: guestId!, guestName: user.name, passcode },
        );
        if (cancelled) return;
        setHourlyRate(joinResp.meeting.hourlyRate);
        setStartedAt(joinResp.meeting.startedAt);
        setTitle(joinResp.meeting.title);

        // A shared passphrase derived from the meeting code — anyone who has the
        // code can already join the meeting anyway, so this doesn't weaken the
        // trust model, it just extends it to also encrypt media end-to-end.
        if (isE2EESupported()) {
          try {
            await keyProvider.setKey(meetingCode);
            await room.setE2EEEnabled(true);
          } catch (e2eeErr) {
            console.error("Could not enable end-to-end encryption:", e2eeErr);
          }
        }

        await room.connect(joinResp.livekitUrl, joinResp.livekitToken);
        if (cancelled) return;
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));

        // Camera/mic may be unavailable or permission may be denied; still
        // let the participant join and see/hear everyone else. Respect
        // whatever on/off choice they made in the pre-join lobby.
        //
        // When the lobby already acquired a live camera/mic stream, hand
        // its tracks straight to LiveKit instead of calling
        // setCameraEnabled/setMicrophoneEnabled (which calls getUserMedia
        // again from scratch) — releasing a device and immediately
        // re-requesting it is a real race the OS/driver can lose, and was
        // exactly why a joining participant's camera would sometimes come
        // up off. Falls back to the old acquire-fresh path if the lobby
        // didn't hand off a track for that device (e.g. it never got
        // permission in the first place).
        const preAcquiredVideoTrack = preAcquiredStream?.getVideoTracks()[0];
        const preAcquiredAudioTrack = preAcquiredStream?.getAudioTracks()[0];

        if (preAcquiredVideoTrack) {
          if (initialCameraEnabled) {
            await room.localParticipant
              .publishTrack(preAcquiredVideoTrack, { source: Track.Source.Camera })
              .catch((camErr) => {
                console.error("Could not enable camera:", camErr);
              });
          } else {
            preAcquiredVideoTrack.stop();
          }
        } else if (initialCameraEnabled) {
          await room.localParticipant.setCameraEnabled(true).catch((camErr) => {
            console.error("Could not enable camera:", camErr);
          });
        }

        if (preAcquiredAudioTrack) {
          if (initialMicEnabled) {
            await room.localParticipant
              .publishTrack(preAcquiredAudioTrack, { source: Track.Source.Microphone })
              .catch((micErr) => {
                console.error("Could not enable microphone:", micErr);
              });
          } else {
            preAcquiredAudioTrack.stop();
          }
        } else if (initialMicEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true).catch((micErr) => {
            console.error("Could not enable microphone:", micErr);
          });
        }
        // isMuted/isCameraOn were only seeded from these at the hook's first
        // mount (before the lobby had collected a real choice) — resync now
        // so the Controls UI matches what was actually just requested above.
        setIsMuted(!initialMicEnabled);
        setIsCameraOn(initialCameraEnabled);
        setConnected(true);

        const list = await api.getParticipants(meetingCode);
        if (!cancelled) setParticipants(list.participants);

        const recordings = await api.getRecordings(meetingCode).catch(() => ({ recordings: [] }));
        if (!cancelled) {
          const active = recordings.recordings.find((r) => r.status === "recording");
          setIsRecording(Boolean(active));
          setRecordingStartedAt(active?.createdAt ?? null);
        }

        const socket = handshakeSocket;
        socket.emit("join-room", { meetingCode, userId: user.id, name: user.name });
        socket.emit("set-caption-language", { meetingCode, userId: user.id, language: captionLanguage });

        socket.on("active-view-changed", ({ view }: { view: ActiveView }) => {
          setActiveViewState(view);
        });

        socket.on("whiteboard-history", (history: WhiteboardStroke[]) => {
          whiteboardHistoryRef.current = history;
        });
        socket.on(
          "whiteboard-stroke-start",
          ({ strokeId, color, point }: { strokeId: string; color: string; point: WhiteboardPoint }) => {
            whiteboardHistoryRef.current.push({ id: strokeId, color, points: [point] });
          },
        );
        socket.on("whiteboard-point", ({ strokeId, point }: { strokeId: string; point: WhiteboardPoint }) => {
          const stroke = whiteboardHistoryRef.current.find((s) => s.id === strokeId);
          stroke?.points.push(point);
        });
        socket.on("whiteboard-clear", () => {
          whiteboardHistoryRef.current = [];
        });

        socket.on("virtual-office-positions", (positions: Record<string, AvatarPosition>) => {
          setAvatarPositions(positions);
        });
        socket.on("avatar-moved", ({ userId, x, y }: { userId: string; x: number; y: number }) => {
          setAvatarPositions((prev) => ({ ...prev, [userId]: { x, y } }));
        });

        socket.on("user-joined", ({ userId, name }: { userId: string; name: string }) => {
          setParticipants((prev) =>
            prev.some((p) => p.userId === userId)
              ? prev
              : [...prev, { userId, name, role: "participant", joinedAt: new Date().toISOString() }],
          );
          pushNotification(`${name} joined the meeting`);
        });
        socket.on("user-left", ({ userId, name }: { userId: string; name?: string }) => {
          setParticipants((prev) => prev.filter((p) => p.userId !== userId));
          setAvatarPositions((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
          setRaisedHands((prev) => prev.filter((id) => id !== userId));
          setPinnedUserIdState((prev) => (prev === userId ? null : prev));
          pushNotification(`${name ?? "Someone"} left the meeting`);
        });

        socket.on("hand-updated", ({ userId, raised }: { userId: string; raised: boolean }) => {
          setRaisedHands((prev) => {
            if (raised) return prev.includes(userId) ? prev : [...prev, userId];
            return prev.filter((id) => id !== userId);
          });
        });
        socket.on("raised-hands-sync", (userIds: string[]) => {
          setRaisedHands(userIds);
        });
        socket.on("reaction", ({ userId, name, emoji }: { userId: string; name: string; emoji: string }) => {
          const id = generateId();
          const offset = Math.random() * 60 - 30;
          setReactions((prev) => [...prev, { id, userId, name, emoji, offset }]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== id));
          }, 3000);
        });

        socket.on("join-request", ({ requestId, userId, name }: JoinRequestEntry) => {
          setJoinRequests((prev) =>
            prev.some((r) => r.requestId === requestId) ? prev : [...prev, { requestId, userId, name }],
          );
          pushNotification(`${name} wants to join the meeting`);
        });
        socket.on("join-requests-sync", (requests: JoinRequestEntry[]) => {
          setJoinRequests(requests);
        });
        socket.on("join-request-resolved", ({ requestId }: { requestId: string }) => {
          setJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
        });

        socket.on(
          "media-permission-changed",
          ({ userId, kind, blocked }: { userId: string; kind: MediaKind; blocked: boolean }) => {
            setMediaRestrictions((prev) => {
              const current = new Set(prev[userId] ?? []);
              if (blocked) {
                current.add(kind);
              } else {
                current.delete(kind);
              }
              return { ...prev, [userId]: Array.from(current) };
            });
            if (userId !== user.id) return;
            if (kind === "microphone") {
              if (blocked) {
                room.localParticipant.setMicrophoneEnabled(false).catch(() => undefined);
                setIsMuted(true);
              } else {
                withRetries(() => room.localParticipant.setMicrophoneEnabled(true)).then((ok) => {
                  setIsMuted(!ok);
                  if (!ok) pushNotification("Couldn't turn the microphone back on — try the mic button.");
                });
              }
            } else if (kind === "camera") {
              if (blocked) {
                room.localParticipant.setCameraEnabled(false).catch(() => undefined);
                setIsCameraOn(false);
              } else {
                withRetries(() => room.localParticipant.setCameraEnabled(true)).then((ok) => {
                  setIsCameraOn(ok);
                  if (!ok) pushNotification("Couldn't turn the camera back on — try the camera button.");
                });
              }
            } else if (kind === "screen_share" && blocked) {
              room.localParticipant.setScreenShareEnabled(false).catch(() => undefined);
              setIsScreenSharing(false);
            }
          },
        );
        socket.on("media-permissions-sync", (restrictions: Record<string, MediaKind[]>) => {
          setMediaRestrictions(restrictions);
        });
        socket.on("pinned-participant-changed", ({ userId }: { userId: string | null }) => {
          setPinnedUserIdState(userId);
        });
        socket.on("pinned-participant-sync", ({ userId }: { userId: string | null }) => {
          setPinnedUserIdState(userId);
        });
        socket.on("kicked", () => {
          setKicked(true);
          room.disconnect();
        });
        socket.on("host-controls-sync", ({ settings }: { settings: HostControlSettings }) => {
          setHostControls(settings);
        });
        socket.on("host-controls-changed", ({ settings }: { settings: HostControlSettings }) => {
          setHostControls(settings);
        });
        socket.on("new-message", (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg]);
        });
        socket.on("ai-response-start", ({ requestId }: { requestId: string }) => {
          setMessages((prev) => [
            ...prev,
            {
              userId: "ai",
              name: "AI Assistant",
              text: "",
              timestamp: new Date().toISOString(),
              isAI: true,
              streaming: true,
              requestId,
            },
          ]);
        });
        socket.on("ai-response-chunk", ({ requestId, delta }: { requestId: string; delta: string }) => {
          setMessages((prev) =>
            prev.map((m) => (m.requestId === requestId ? { ...m, text: m.text + delta } : m)),
          );
        });
        socket.on("ai-response-end", ({ requestId }: { requestId: string }) => {
          setMessages((prev) =>
            prev.map((m) => (m.requestId === requestId ? { ...m, streaming: false } : m)),
          );
        });
        socket.on("ai-response-error", ({ requestId }: { requestId: string }) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.requestId === requestId
                ? { ...m, streaming: false, text: m.text || "Sorry, I couldn't answer that." }
                : m,
            ),
          );
        });
        socket.on(
          "caption",
          (entry: { userId: string; name: string; sourceText: string; translations: Record<string, string>; timestamp: string }) => {
            const id = generateId();
            setCaptions((prev) => [...prev, { id, ...entry }]);
            setTimeout(() => {
              setCaptions((prev) => prev.filter((c) => c.id !== id));
            }, 6000);
          },
        );
        socket.on("recording-started", ({ startedAt }: { startedAt: string }) => {
          setIsRecording(true);
          setRecordingStartedAt(startedAt);
        });
        socket.on("recording-stopped", () => {
          setIsRecording(false);
          setRecordingStartedAt(null);
        });
        socket.on("meeting-ended", (payload: { totalCost?: number } | undefined) => {
          if (typeof payload?.totalCost === "number") {
            setFinalCost(payload.totalCost);
          }
          setMeetingEnded(true);
        });
      } catch (err) {
        console.error("useMeeting setup failed:", err);
        if (cancelled) return;
        if (err instanceof api.ApiError && err.status === 402) {
          const body = err.body as { priceCents?: number; currency?: string } | null;
          setPaymentRequired({ priceCents: body?.priceCents ?? 0, currency: body?.currency ?? "usd" });
        } else {
          setError(err instanceof Error ? err.message : "Failed to join meeting");
        }
      }
    }

    setup();

    return () => {
      cancelled = true;
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.TrackPublished, handleTrackPublished);
      room.off(RoomEvent.TrackUnpublished, handleTrackUnpublished);
      room.off(RoomEvent.LocalTrackPublished, handleTrackPublished);
      room.off(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
      room.off(RoomEvent.ParticipantEncryptionStatusChanged, handleEncryptionStatusChanged);
      room.off(RoomEvent.ConnectionQualityChanged, handleConnectionQualityChanged);
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      room.disconnect();
    };
  }, [
    meetingCode,
    accessToken,
    currentUser,
    guestId,
    passcode,
    shouldJoin,
    initialMicEnabled,
    initialCameraEnabled,
    preAcquiredStream,
    room,
  ]);

  const CAPTION_CHUNK_MS = 8000;

  useEffect(() => {
    if (!captionsEnabled || !connected || isMuted || !accessToken) {
      return;
    }
    const token = accessToken;

    let cancelled = false;
    let activeRecorder: MediaRecorder | null = null;

    async function recordChunk() {
      if (cancelled) return;
      const micPublication = room.localParticipant.getTrackPublication(Track.Source.Microphone);
      const track = micPublication?.track?.mediaStreamTrack;
      if (!track) {
        return;
      }

      const stream = new MediaStream([track]);
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      activeRecorder = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, CAPTION_CHUNK_MS));
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      await stopped;
      activeRecorder = null;
      if (cancelled) return;

      if (chunks.length > 0) {
        const blob = new Blob(chunks, { type: "audio/webm" });
        api.uploadCaptionChunk(token, meetingCode, blob).catch((err) => {
          console.error("Failed to upload caption chunk:", err);
        });
      }

      if (!cancelled) {
        recordChunk();
      }
    }

    recordChunk();

    return () => {
      cancelled = true;
      if (activeRecorder && activeRecorder.state !== "inactive") {
        activeRecorder.stop();
      }
    };
  }, [captionsEnabled, connected, isMuted, room, meetingCode, accessToken]);

  useEffect(() => {
    if (!socket) return;

    function handleLocalUpdate(update: Uint8Array, origin: unknown) {
      if (origin !== "remote") {
        socket!.emit("code-update", { meetingCode, update });
      }
    }
    function handleRemoteUpdate(update: Uint8Array | ArrayBuffer) {
      // Socket.io delivers binary payloads to the browser as ArrayBuffer, not
      // Uint8Array — Yjs's decoder needs a real typed array or it throws.
      const bytes = update instanceof Uint8Array ? update : new Uint8Array(update);
      Y.applyUpdate(ydoc, bytes, "remote");
    }

    ydoc.on("update", handleLocalUpdate);
    socket.on("code-update", handleRemoteUpdate);
    socket.on("code-sync", handleRemoteUpdate);

    return () => {
      ydoc.off("update", handleLocalUpdate);
      socket.off("code-update", handleRemoteUpdate);
      socket.off("code-sync", handleRemoteUpdate);
    };
  }, [socket, ydoc, meetingCode]);

  const respondToJoinRequest = useCallback(
    (requestId: string, approve: boolean) => {
      socketRef.current?.emit("respond-join-request", { meetingCode, requestId, approve });
      setJoinRequests((prev) => prev.filter((r) => r.requestId !== requestId));
    },
    [meetingCode],
  );

  const setParticipantMedia = useCallback(
    (targetUserId: string, kind: MediaKind, blocked: boolean) => {
      socketRef.current?.emit("host-set-media", { meetingCode, targetUserId, kind, blocked });
    },
    [meetingCode],
  );

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
    } catch {
      pushNotification("Couldn't reach the microphone — check device permissions and try again.");
      return;
    }
    setIsMuted(next);
    socketRef.current?.emit("toggle-mute", { meetingCode, userId: currentUser?.id, isMuted: next });
  }, [isMuted, room, meetingCode, currentUser, pushNotification]);

  const toggleCamera = useCallback(async () => {
    const next = !isCameraOn;
    try {
      await room.localParticipant.setCameraEnabled(next);
    } catch {
      pushNotification("Couldn't reach the camera — check device permissions and try again.");
      return;
    }
    setIsCameraOn(next);
    socketRef.current?.emit("toggle-camera", { meetingCode, userId: currentUser?.id, isCameraOn: next });
  }, [isCameraOn, room, meetingCode, currentUser, pushNotification]);

  const toggleScreenShare = useCallback(async () => {
    const next = !isScreenSharing;
    await room.localParticipant.setScreenShareEnabled(next, { audio: true });
    setIsScreenSharing(next);
  }, [isScreenSharing, room]);

  const toggleRecording = useCallback(async () => {
    if (!accessToken) return;
    // Don't flip isRecording here — the backend broadcasts
    // recording-started/recording-stopped to the whole room (including the
    // host who clicked), so every participant's indicator stays in sync
    // from one source of truth instead of drifting on a race or error.
    try {
      if (isRecording) {
        await api.stopRecording(accessToken, meetingCode);
      } else {
        await api.startRecording(accessToken, meetingCode);
      }
    } catch (err) {
      pushNotification(err instanceof Error ? err.message : "Could not update recording");
    }
  }, [isRecording, accessToken, meetingCode, pushNotification]);

  const sendMessage = useCallback(
    (text: string) => {
      if (!currentUser) return;
      socketRef.current?.emit("send-message", {
        meetingCode,
        userId: currentUser.id,
        name: currentUser.name,
        text,
      });
    },
    [meetingCode, currentUser],
  );

  const sendPrivateMessage = useCallback(
    (targetUserId: string, text: string) => {
      if (!currentUser) return;
      socketRef.current?.emit("send-private-message", {
        meetingCode,
        userId: currentUser.id,
        name: currentUser.name,
        targetUserId,
        text,
      });
    },
    [meetingCode, currentUser],
  );

  const askAI = useCallback(
    (question: string) => {
      if (!currentUser) return;
      socketRef.current?.emit("ask-ai", {
        meetingCode,
        userId: currentUser.id,
        name: currentUser.name,
        question,
      });
    },
    [meetingCode, currentUser],
  );

  const toggleCaptions = useCallback(() => {
    setCaptionsEnabled((prev) => !prev);
  }, []);

  const setCaptionLanguage = useCallback(
    (language: string) => {
      setCaptionLanguageState(language);
      if (currentUser) {
        socketRef.current?.emit("set-caption-language", { meetingCode, userId: currentUser.id, language });
      }
    },
    [meetingCode, currentUser],
  );

  const moveAvatar = useCallback(
    (x: number, y: number) => {
      setMyAvatarPosition({ x, y });
      if (currentUser) {
        socketRef.current?.emit("avatar-move", { meetingCode, userId: currentUser.id, x, y });
      }
    },
    [meetingCode, currentUser],
  );

  const toggleHandRaise = useCallback(() => {
    if (!currentUser) return;
    const next = !raisedHands.includes(currentUser.id);
    setRaisedHands((prev) => (next ? [...prev, currentUser.id] : prev.filter((id) => id !== currentUser.id)));
    socketRef.current?.emit("toggle-hand", { meetingCode, userId: currentUser.id, raised: next });
  }, [meetingCode, currentUser, raisedHands]);

  const sendReaction = useCallback(
    (emoji: string) => {
      if (!currentUser) return;
      socketRef.current?.emit("send-reaction", { meetingCode, userId: currentUser.id, name: currentUser.name, emoji });
    },
    [meetingCode, currentUser],
  );

  const setActiveView = useCallback(
    (view: ActiveView) => {
      setActiveViewState(view);
      socketRef.current?.emit("set-active-view", { meetingCode, view });
    },
    [meetingCode],
  );

  const setPinnedParticipant = useCallback(
    (targetUserId: string | null) => {
      socketRef.current?.emit("set-pinned-participant", { meetingCode, targetUserId });
    },
    [meetingCode],
  );

  const kickParticipant = useCallback(
    (targetUserId: string) => {
      socketRef.current?.emit("kick-participant", { meetingCode, targetUserId });
    },
    [meetingCode],
  );

  const updateHostControls = useCallback(
    (patch: Partial<HostControlSettings>) => {
      socketRef.current?.emit("set-host-controls", { meetingCode, settings: patch });
    },
    [meetingCode],
  );

  const payAndJoin = useCallback(async () => {
    if (!accessToken) return;
    const successUrl = `${window.location.origin}/meeting/${meetingCode}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${window.location.origin}/dashboard`;
    const { url } = await api.createCheckoutSession(accessToken, meetingCode, successUrl, cancelUrl);
    window.location.href = url;
  }, [accessToken, meetingCode]);

  const leave = useCallback(async () => {
    if (accessToken || guestId) {
      await api.leaveMeeting(accessToken, meetingCode, guestId ?? undefined).catch(() => undefined);
    }
    socketRef.current?.emit("leave-room", { meetingCode, userId: currentUser?.id });
    socketRef.current?.disconnect();
    await room.disconnect();
  }, [accessToken, guestId, meetingCode, currentUser, room]);

  const endMeetingForAll = useCallback(async () => {
    if (accessToken || guestId) {
      const result = await api.endMeeting(accessToken, meetingCode, guestId ?? undefined);
      setFinalCost(result.totalCost);
      setMeetingEnded(true);
    }
  }, [accessToken, guestId, meetingCode]);

  return {
    room,
    connected,
    remoteParticipants,
    participants,
    messages,
    isMuted,
    isCameraOn,
    isScreenSharing,
    screenShareParticipantIdentity,
    isRecording,
    recordingStartedAt,
    hourlyRate,
    startedAt,
    title,
    connectionQuality,
    activeView,
    setActiveView,
    meetingEnded,
    finalCost,
    error,
    paymentRequired,
    payAndJoin,
    captionsEnabled,
    captionLanguage,
    captions,
    isE2EEEnabled,
    socket,
    ydoc,
    audioContext,
    avatarPositions,
    myAvatarPosition,
    whiteboardHistoryRef,
    moveAvatar,
    waitingForApproval,
    joinDenied,
    joinRequests,
    respondToJoinRequest,
    notifications,
    pushNotification,
    mediaRestrictions,
    setParticipantMedia,
    raisedHands,
    toggleHandRaise,
    reactions,
    sendReaction,
    pinnedUserId,
    setPinnedParticipant,
    kickParticipant,
    kicked,
    hostControls,
    updateHostControls,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    sendMessage,
    sendPrivateMessage,
    askAI,
    toggleCaptions,
    setCaptionLanguage,
    leave,
    endMeetingForAll,
  };
}
