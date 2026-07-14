import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChatPanel } from "../components/meeting/ChatPanel";
import { Controls } from "../components/meeting/Controls";
import { ParticipantList } from "../components/meeting/ParticipantList";
import { VideoTile } from "../components/meeting/VideoTile";
import { useAuth } from "../hooks/useAuth";
import { useMeeting } from "../hooks/useMeeting";

export function MeetingRoomPage() {
  const { meetingCode = "" } = useParams<{ meetingCode: string }>();
  const { user, accessToken } = useAuth();
  const navigate = useNavigate();

  const currentUser = user ? { id: user.id, name: user.name } : null;
  const {
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
  } = useMeeting(meetingCode, accessToken, currentUser);

  useEffect(() => {
    if (meetingEnded) {
      navigate("/dashboard");
    }
  }, [meetingEnded, navigate]);

  async function handleLeave() {
    await leave();
    navigate("/dashboard");
  }

  async function handleEndMeeting() {
    await endMeetingForAll();
    navigate("/dashboard");
  }

  const isHost = participants.find((p) => p.userId === user?.id)?.role === "host";

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-900">
        <p className="text-gray-400">Joining meeting...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 overflow-y-auto p-4 sm:grid-cols-3">
          <VideoTile participant={room.localParticipant} name={`${currentUser?.name} (You)`} isLocal />
          {remoteParticipants.map((participant) => (
            <VideoTile
              key={participant.identity}
              participant={participant}
              name={participants.find((p) => p.userId === participant.identity)?.name ?? participant.identity}
            />
          ))}
        </div>
        <div className="flex w-72 flex-col divide-y divide-gray-800 border-l border-gray-800">
          <div className="h-1/2">
            <ParticipantList participants={participants} />
          </div>
          <div className="h-1/2">
            <ChatPanel messages={messages} onSend={sendMessage} />
          </div>
        </div>
      </div>
      <Controls
        isMuted={isMuted}
        isCameraOn={isCameraOn}
        isHost={isHost}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
      />
    </div>
  );
}
