import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { filmstripParticipants, meetingMeta, participants } from "../../data/mockData";
import { ChatPanel } from "./ChatPanel";
import { ControlBar } from "./ControlBar";
import { Filmstrip } from "./Filmstrip";
import { IconRail } from "./IconRail";
import { LeaveModal } from "./LeaveModal";
import { MainStage } from "./MainStage";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { TopBar } from "./TopBar";

interface MeetingPageProps {
  onLeave: () => void;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

type SidebarPanel = "participants" | "chat" | null;

export function MeetingPage({ onLeave }: MeetingPageProps) {
  const [elapsed, setElapsed] = useState(meetingMeta.initialElapsedSeconds);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [notesOn, setNotesOn] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<SidebarPanel>(null);

  const you = participants.find((p) => p.isYou)!;

  useEffect(() => {
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <div className="hidden md:block">
        <TopBar />
      </div>
      <div className="hidden md:block">
        <Filmstrip participants={filmstripParticipants} />
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden p-4">
        <div className="min-w-0 flex-1">
          <MainStage speaker={you} fullscreen={fullscreen} onToggleFullscreen={() => setFullscreen((f) => !f)} />
        </div>

        {!fullscreen && (
          <div className="hidden w-80 flex-shrink-0 flex-col gap-4 xl:flex">
            <ParticipantsPanel participants={participants} />
            <ChatPanel />
          </div>
        )}

        <div className="hidden md:block">
          <IconRail />
        </div>
      </div>

      {mobilePanel && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/30 xl:hidden">
          <div className="flex h-full w-full max-w-sm flex-col gap-4 overflow-y-auto bg-slate-50 p-4">
            <div className="flex justify-end">
              <button
                type="button"
                aria-label="Close panel"
                onClick={() => setMobilePanel(null)}
                className="focus-ring rounded-full border border-border bg-white p-2"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {mobilePanel === "participants" && <ParticipantsPanel participants={participants} />}
            {mobilePanel === "chat" && <ChatPanel />}
          </div>
        </div>
      )}

      <ControlBar
        title={meetingMeta.title}
        elapsedLabel={formatElapsed(elapsed)}
        micOn={micOn}
        cameraOn={cameraOn}
        handRaised={handRaised}
        sharingScreen={sharingScreen}
        onToggleMic={() => setMicOn((v) => !v)}
        onToggleCamera={() => setCameraOn((v) => !v)}
        onToggleHand={() => setHandRaised((v) => !v)}
        onToggleShare={() => setSharingScreen((v) => !v)}
        onEndCall={() => setLeaveModalOpen(true)}
        onToggleNotes={() => setNotesOn((v) => !v)}
        onToggleParticipants={() => setMobilePanel((p) => (p === "participants" ? null : "participants"))}
        onToggleChat={() => setMobilePanel((p) => (p === "chat" ? null : "chat"))}
        notesBadge={notesOn ? 1 : 0}
        participantsBadge={participants.length}
        chatBadge={1}
      />

      {leaveModalOpen && (
        <LeaveModal onCancel={() => setLeaveModalOpen(false)} onConfirm={onLeave} />
      )}
    </div>
  );
}
