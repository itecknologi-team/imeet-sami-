interface ControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isHost: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onLeave: () => void;
  onEndMeeting: () => void;
}

export function Controls({
  isMuted,
  isCameraOn,
  isHost,
  onToggleMute,
  onToggleCamera,
  onLeave,
  onEndMeeting,
}: ControlsProps) {
  return (
    <div className="flex items-center justify-center gap-3 bg-gray-900 p-4">
      <button
        onClick={onToggleMute}
        className={`rounded px-4 py-2 text-sm font-medium text-white ${
          isMuted ? "bg-red-600" : "bg-gray-700"
        }`}
      >
        {isMuted ? "Unmute" : "Mute"}
      </button>
      <button
        onClick={onToggleCamera}
        className={`rounded px-4 py-2 text-sm font-medium text-white ${
          !isCameraOn ? "bg-red-600" : "bg-gray-700"
        }`}
      >
        {isCameraOn ? "Stop Camera" : "Start Camera"}
      </button>
      <button onClick={onLeave} className="rounded bg-gray-700 px-4 py-2 text-sm font-medium text-white">
        Leave
      </button>
      {isHost && (
        <button onClick={onEndMeeting} className="rounded bg-red-700 px-4 py-2 text-sm font-medium text-white">
          End meeting for all
        </button>
      )}
    </div>
  );
}
