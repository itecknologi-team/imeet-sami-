import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, RemoteParticipant, Track } from "livekit-client";
import type { LocalTrackPublication, RemoteTrackPublication, Participant } from "livekit-client";
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareParticipantIdentity, setScreenShareParticipantIdentity] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [finalCost, setFinalCost] = useState<number | null>(null);
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
    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.TrackPublished, handleTrackPublished);
    room.on(RoomEvent.TrackUnpublished, handleTrackUnpublished);
    room.on(RoomEvent.LocalTrackPublished, handleTrackPublished);
    room.on(RoomEvent.LocalTrackUnpublished, handleTrackUnpublished);

    async function setup() {
      try {
        const joinResp = await api.joinMeeting(accessToken!, meetingCode);
        if (cancelled) return;
        setHourlyRate(joinResp.meeting.hourlyRate);
        setStartedAt(joinResp.meeting.startedAt);

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
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
    sendMessage,
    leave,
    endMeetingForAll,
  };
}
