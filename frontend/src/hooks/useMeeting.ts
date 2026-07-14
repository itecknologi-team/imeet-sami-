import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, RemoteParticipant } from "livekit-client";
import type { Socket } from "socket.io-client";
import * as api from "../services/api";
import { createMeetingSocket } from "../services/socket";

export interface ChatMessage {
  userId: string;
  name: string;
  text: string;
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
  const [room] = useState(() => new Room());
  const [connected, setConnected] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<RemoteParticipant[]>([]);
  const [participants, setParticipants] = useState<MeetingParticipantInfo[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    async function setup() {
      try {
        const joinResp = await api.joinMeeting(accessToken!, meetingCode);
        if (cancelled) return;

        await room.connect(joinResp.livekitUrl, joinResp.livekitToken);
        if (cancelled) return;
        setRemoteParticipants(Array.from(room.remoteParticipants.values()));

        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        setConnected(true);

        const list = await api.getParticipants(meetingCode);
        if (!cancelled) setParticipants(list.participants);

        const socket = createMeetingSocket();
        socketRef.current = socket;
        socket.emit("join-room", { meetingCode, userId: user.id, name: user.name });

        socket.on("user-joined", ({ userId, name }: { userId: string; name: string }) => {
          setParticipants((prev) =>
            prev.some((p) => p.userId === userId)
              ? prev
              : [...prev, { userId, name, role: "participant", joinedAt: new Date().toISOString() }],
          );
        });
        socket.on("user-left", ({ userId }: { userId: string }) => {
          setParticipants((prev) => prev.filter((p) => p.userId !== userId));
        });
        socket.on("new-message", (msg: ChatMessage) => {
          setMessages((prev) => [...prev, msg]);
        });
        socket.on("meeting-ended", () => {
          setMeetingEnded(true);
        });
      } catch (err) {
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
      socketRef.current?.disconnect();
      socketRef.current = null;
      room.disconnect();
    };
  }, [meetingCode, accessToken, currentUser, room]);

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
      await api.endMeeting(accessToken, meetingCode);
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
    meetingEnded,
    error,
    toggleMute,
    toggleCamera,
    sendMessage,
    leave,
    endMeetingForAll,
  };
}
