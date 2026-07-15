interface ControlsProps {
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
  screenShareDisabled: boolean;
  isRecording: boolean;
  isHost: boolean;
  captionsEnabled: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onToggleRecording: () => void;
  onToggleCaptions: () => void;
  onLeave: () => void;
  onEndMeeting: () => void;
}

export function Controls({
  isMuted,
  isCameraOn,
  isScreenSharing,
  screenShareDisabled,
  isRecording,
  isHost,
  captionsEnabled,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onToggleRecording,
  onToggleCaptions,
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
      <button
        onClick={onToggleScreenShare}
        disabled={screenShareDisabled}
        className={`rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-40 ${
          isScreenSharing ? "bg-blue-600" : "bg-gray-700"
        }`}
      >
        {isScreenSharing ? "Stop Sharing" : "Share Screen"}
      </button>
      {isHost && (
        <button
          onClick={onToggleRecording}
          className={`rounded px-4 py-2 text-sm font-medium text-white ${
            isRecording ? "bg-red-600" : "bg-gray-700"
          }`}
        >
          {isRecording ? "Stop Recording" : "Record"}
        </button>
      )}
      <button
        onClick={onToggleCaptions}
        className={`rounded px-4 py-2 text-sm font-medium text-white ${
          captionsEnabled ? "bg-purple-600" : "bg-gray-700"
        }`}
      >
        {captionsEnabled ? "Live Captions: On" : "Live Captions: Off"}
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
