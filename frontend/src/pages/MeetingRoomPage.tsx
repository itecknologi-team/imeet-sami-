import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Track } from "livekit-client";
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
    isScreenSharing,
    screenShareParticipantIdentity,
    isRecording,
    meetingEnded,
    error,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    toggleRecording,
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

  const localIdentity = room.localParticipant.identity;
  const isLocalScreenShare = screenShareParticipantIdentity === localIdentity;
  const screenShareRemoteParticipant = remoteParticipants.find(
    (p) => p.identity === screenShareParticipantIdentity,
  );

  return (
    <div className="flex min-h-screen flex-col bg-gray-900">
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
          {screenShareParticipantIdentity && (
            <div className="flex-[3]">
              {isLocalScreenShare && (
                <VideoTile
                  participant={room.localParticipant}
                  name={`${currentUser?.name} (You) — sharing screen`}
                  isLocal
                  videoSource={Track.Source.ScreenShare}
                />
              )}
              {screenShareRemoteParticipant && (
                <VideoTile
                  participant={screenShareRemoteParticipant}
                  name={`${
                    participants.find((p) => p.userId === screenShareRemoteParticipant.identity)?.name ??
                    screenShareRemoteParticipant.identity
                  } — sharing screen`}
                  videoSource={Track.Source.ScreenShare}
                />
              )}
            </div>
          )}
          <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">
            <VideoTile participant={room.localParticipant} name={`${currentUser?.name} (You)`} isLocal />
            {remoteParticipants.map((participant) => (
              <VideoTile
                key={participant.identity}
                participant={participant}
                name={participants.find((p) => p.userId === participant.identity)?.name ?? participant.identity}
              />
            ))}
          </div>
        </div>
        <div className="flex w-72 flex-col divide-y divide-gray-800 border-l border-gray-800">
          <div className="flex items-center justify-between px-4 py-2">
            {isRecording && (
              <span className="flex items-center gap-1 text-xs text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" /> Recording
              </span>
            )}
            <Link to={`/meeting/${meetingCode}/recordings`} className="text-xs text-blue-400 hover:underline">
              View Recordings
            </Link>
          </div>
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
        isScreenSharing={isScreenSharing}
        screenShareDisabled={!isScreenSharing && screenShareParticipantIdentity !== null}
        isRecording={isRecording}
        isHost={isHost}
        onToggleMute={toggleMute}
        onToggleCamera={toggleCamera}
        onToggleScreenShare={toggleScreenShare}
        onToggleRecording={toggleRecording}
        onLeave={handleLeave}
        onEndMeeting={handleEndMeeting}
      />
    </div>
  );
}
