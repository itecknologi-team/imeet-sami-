import {
  ChevronUp,
  FileText,
  Hand,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Users,
  Video,
  VideoOff,
} from "lucide-react";
import { useState } from "react";
import { IconButton } from "../ui/IconButton";

interface ControlBarProps {
  title: string;
  elapsedLabel: string;
  micOn: boolean;
  cameraOn: boolean;
  handRaised: boolean;
  sharingScreen: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleHand: () => void;
  onToggleShare: () => void;
  onEndCall: () => void;
  onToggleNotes: () => void;
  onToggleParticipants: () => void;
  onToggleChat: () => void;
  notesBadge: number;
  participantsBadge: number;
  chatBadge: number;
}

export function ControlBar({
  title,
  elapsedLabel,
  micOn,
  cameraOn,
  handRaised,
  sharingScreen,
  onToggleMic,
  onToggleCamera,
  onToggleHand,
  onToggleShare,
  onEndCall,
  onToggleNotes,
  onToggleParticipants,
  onToggleChat,
  notesBadge,
  participantsBadge,
  chatBadge,
}: ControlBarProps) {
  const [deviceMenu, setDeviceMenu] = useState<"camera" | "mic" | null>(null);

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-border bg-white px-4 py-3">
      <div className="min-w-[140px] text-sm">
        <p className="font-mono font-semibold text-text">{elapsedLabel}</p>
        <p className="truncate text-xs text-muted">{title}</p>
      </div>

      <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
        <div
          className={`relative flex items-center divide-x rounded-full border ${
            cameraOn ? "divide-border border-border bg-white" : "divide-brand-blue/20 border-brand-blue/30 bg-brand-blue/10"
          }`}
        >
          <button
            type="button"
            aria-label={cameraOn ? "Turn off camera" : "Turn on camera"}
            onClick={onToggleCamera}
            className={`focus-ring flex h-11 w-11 items-center justify-center rounded-l-full ${
              cameraOn ? "text-text hover:bg-slate-50" : "text-brand-blue"
            }`}
          >
            {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Camera options"
            onClick={() => setDeviceMenu((m) => (m === "camera" ? null : "camera"))}
            className={`focus-ring flex h-11 w-7 items-center justify-center rounded-r-full ${
              cameraOn ? "text-muted hover:bg-slate-50" : "text-brand-blue"
            }`}
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          {deviceMenu === "camera" && (
            <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-border bg-white p-1 text-xs shadow-soft">
              <p className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50">Built-in Camera</p>
              <p className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50">External Webcam</p>
            </div>
          )}
        </div>

        <div
          className={`relative flex items-center divide-x rounded-full border ${
            micOn ? "divide-border border-border bg-white" : "divide-brand-blue/20 border-brand-blue/30 bg-brand-blue/10"
          }`}
        >
          <button
            type="button"
            aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            onClick={onToggleMic}
            className={`focus-ring flex h-11 w-11 items-center justify-center rounded-l-full ${
              micOn ? "text-text hover:bg-slate-50" : "text-brand-blue"
            }`}
          >
            {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label="Microphone options"
            onClick={() => setDeviceMenu((m) => (m === "mic" ? null : "mic"))}
            className={`focus-ring flex h-11 w-7 items-center justify-center rounded-r-full ${
              micOn ? "text-muted hover:bg-slate-50" : "text-brand-blue"
            }`}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          {deviceMenu === "mic" && (
            <div className="absolute bottom-full left-0 mb-2 w-44 rounded-lg border border-border bg-white p-1 text-xs shadow-soft">
              <p className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50">Built-in Microphone</p>
              <p className="cursor-pointer rounded px-2 py-1.5 hover:bg-slate-50">Headset Mic</p>
            </div>
          )}
        </div>

        <IconButton
          icon={<PhoneOff className="h-6 w-6" />}
          label="Leave call"
          variant="danger"
          size="lg"
          onClick={onEndCall}
        />

        <IconButton
          icon={<MonitorUp className="h-4 w-4" />}
          label={sharingScreen ? "Stop sharing" : "Share screen"}
          active={sharingScreen}
          onClick={onToggleShare}
        />
        <IconButton
          icon={<Hand className="h-4 w-4" />}
          label={handRaised ? "Lower hand" : "Raise hand"}
          active={handRaised}
          onClick={onToggleHand}
        />
        <IconButton icon={<MoreHorizontal className="h-4 w-4" />} label="More options" />
      </div>

      <div className="flex items-center gap-2">
        <IconButton icon={<FileText className="h-4 w-4" />} label="Notes" badge={notesBadge} onClick={onToggleNotes} />
        <IconButton
          icon={<Users className="h-4 w-4" />}
          label="Participants"
          badge={participantsBadge}
          onClick={onToggleParticipants}
        />
        <IconButton icon={<MessageSquare className="h-4 w-4" />} label="Chat" badge={chatBadge} onClick={onToggleChat} />
      </div>
    </div>
  );
}
