import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  Track,
  ExternalE2EEKeyProvider,
  isE2EESupported,
} from "livekit-client";
import type { LocalTrackPublication, RemoteTrackPublication, Participant } from "livekit-client";
import type { Socket } from "socket.io-client";
import * as Y from "yjs";
import * as api from "../services/api";
import { createMeetingSocket } from "../services/socket";

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

export const VIRTUAL_OFFICE_DEFAULT_POSITION: AvatarPosition = { x: 400, y: 250 };

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
  timestamp: string;
  isAI?: boolean;
  requestId?: string;
  streaming?: boolean;
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

interface CurrentUser {
  id: string;
  name: string;
}

export function useMeeting(meetingCode: string, accessToken: string | null, currentUser: CurrentUser | null) {
  const [keyProvider] = useState(() => new ExternalE2EEKeyProvider());
  const [room] = useState(() => {
    const worker = new Worker(new URL("livekit-client/e2ee-worker", import.meta.url), { type: "module" });
    return new Room({ e2ee: { keyProvider, worker } });
  });
  const [isE2EEEnabled, setIsE2EEEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [participants, setParticipants] = useState<MeetingParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareParticipantIdentity, setScreenShareParticipantIdentity] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [finalCost, setFinalCost] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionLanguage, setCaptionLanguageState] = useState("en");
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [ydoc] = useState(() => new Y.Doc());
  const [audioContext] = useState(() => new AudioContext());
  const [avatarPositions, setAvatarPositions] = useState<Record<string, AvatarPosition>>({});
  const [myAvatarPosition, setMyAvatarPosition] = useState<AvatarPosition>(VIRTUAL_OFFICE_DEFAULT_POSITION);
  const whiteboardHistoryRef = useRef<WhiteboardStroke[]>([]);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!accessToken || !currentUser) {
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
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.ParticipantEncryptionStatusChanged, handleEncryptionStatusChanged);

    async function setup() {
      try {
        const joinResp = await api.joinMeeting(accessToken!, meetingCode);
        if (cancelled) return;
        setHourlyRate(joinResp.meeting.hourlyRate);
        setStartedAt(joinResp.meeting.startedAt);

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
        // let the participant join and see/hear everyone else.
        await room.localParticipant.setMicrophoneEnabled(true).catch((micErr) => {
          console.error("Could not enable microphone:", micErr);
        });
        await room.localParticipant.setCameraEnabled(true).catch((camErr) => {
          console.error("Could not enable camera:", camErr);
        });
        setConnected(true);

        const list = await api.getParticipants(meetingCode);
        if (!cancelled) setParticipants(list.participants);

        const recordings = await api.getRecordings(meetingCode).catch(() => ({ recordings: [] }));
        if (!cancelled) {
          setIsRecording(recordings.recordings.some((r) => r.status === "recording"));
        }

        const socket = createMeetingSocket();
        socketRef.current = socket;
        setSocket(socket);
        socket.emit("join-room", { meetingCode, userId: user.id, name: user.name });
        socket.emit("set-caption-language", { meetingCode, userId: user.id, language: captionLanguage });

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
        });
        socket.on("user-left", ({ userId }: { userId: string }) => {
          setParticipants((prev) => prev.filter((p) => p.userId !== userId));
          setAvatarPositions((prev) => {
            const next = { ...prev };
            delete next[userId];
            return next;
          });
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
            const id = crypto.randomUUID();
            setCaptions((prev) => [...prev, { id, ...entry }]);
            setTimeout(() => {
              setCaptions((prev) => prev.filter((c) => c.id !== id));
            }, 6000);
          },
        );
        socket.on("meeting-ended", (payload: { totalCost?: number } | undefined) => {
          if (typeof payload?.totalCost === "number") {
            setFinalCost(payload.totalCost);
          }
          setMeetingEnded(true);
        });
      } catch (err) {
        console.error("useMeeting setup failed:", err);
        if (!cancelled) {
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
      socketRef.current?.disconnect();
      socketRef.current = null;
      setSocket(null);
      room.disconnect();
    };
  }, [meetingCode, accessToken, currentUser, room]);

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

  const toggleMute = useCallback(async () => {
    const next = !isMuted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
    socketRef.current?.emit("toggle-mute", { meetingCode, userId: currentUser?.id, isMuted: next });
  }, [isMuted, room, meetingCode, currentUser]);

  const toggleCamera = useCallback(async () => {
    const next = !isCameraOn;
    await room.localParticipant.setCameraEnabled(next);
    setIsCameraOn(next);
    socketRef.current?.emit("toggle-camera", { meetingCode, userId: currentUser?.id, isCameraOn: next });
  }, [isCameraOn, room, meetingCode, currentUser]);

  const toggleScreenShare = useCallback(async () => {
    const next = !isScreenSharing;
    await room.localParticipant.setScreenShareEnabled(next, { audio: true });
    setIsScreenSharing(next);
  }, [isScreenSharing, room]);

  const toggleRecording = useCallback(async () => {
    if (!accessToken) return;
    if (isRecording) {
      await api.stopRecording(accessToken, meetingCode);
      setIsRecording(false);
    } else {
      await api.startRecording(accessToken, meetingCode);
      setIsRecording(true);
    }
  }, [isRecording, accessToken, meetingCode]);

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

  const leave = useCallback(async () => {
    if (accessToken) {
      await api.leaveMeeting(accessToken, meetingCode).catch(() => undefined);
    }
    socketRef.current?.emit("leave-room", { meetingCode, userId: currentUser?.id });
    socketRef.current?.disconnect();
    await room.disconnect();
  }, [accessToken, meetingCode, currentUser, room]);

  const endMeetingForAll = useCallback(async () => {
    if (accessToken) {
      const result = await api.endMeeting(accessToken, meetingCode);
      setFinalCost(result.totalCost);
      setMeetingEnded(true);
    }
  }, [accessToken, meetingCode]);

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
    hourlyRate,
    startedAt,
    meetingEnded,
    finalCost,
    error,
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
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    sendMessage,
    askAI,
    toggleCaptions,
    setCaptionLanguage,
    leave,
    endMeetingForAll,
  };
}
