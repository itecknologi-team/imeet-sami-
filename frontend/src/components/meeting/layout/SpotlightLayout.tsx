import { Track } from "livekit-client";
import { ParticipantTile } from "./ParticipantTile";
import type { LayoutParticipant } from "./types";
import type { ScreenShareInfo } from "./FilmstripLayout";

interface SpotlightLayoutProps {
  participants: LayoutParticipant[];
  stageParticipantId: string | null;
  pinnedId: string | null;
  onSpotlight: (id: string) => void;
  screenShare?: ScreenShareInfo | null;
}

// One tile fills the stage — chosen by the caller's priority order (explicit
// pin, else screen share, else active speaker) — plus a minimal self-preview
// if the local participant isn't the one on stage.
export function SpotlightLayout({ participants, stageParticipantId, pinnedId, onSpotlight, screenShare = null }: SpotlightLayoutProps) {
  const stageParticipant = !screenShare ? (participants.find((p) => p.id === stageParticipantId) ?? participants[0]) : undefined;
  const local = participants.find((p) => p.isLocal);
  const showSelfPreview = local && !screenShare && local.id !== stageParticipant?.id;

  return (
    <div className="relative min-h-0 w-full flex-1 rounded-2xl bg-[#F4F7FA] p-3">
      <div className="meeting-stage-enter h-full min-h-0" key={screenShare ? "screen-share" : (stageParticipant?.id ?? "empty")}>
        {screenShare ? (
          <ParticipantTile
            id={screenShare.participant.identity}
            participant={screenShare.participant}
            name={screenShare.name}
            videoSource={Track.Source.ScreenShare}
            variant="stage"
          />
        ) : stageParticipant ? (
          <ParticipantTile
            id={stageParticipant.id}
            participant={stageParticipant.participant}
            name={stageParticipant.name}
            isLocal={stageParticipant.isLocal}
            isSpeaking={stageParticipant.isSpeaking}
            isPinned={pinnedId === stageParticipant.id}
            variant="stage"
            onSpotlight={onSpotlight}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[var(--meeting-radius-lg)] border border-brand-border bg-white text-sm text-brand-muted">
            Waiting for others to join
          </div>
        )}
      </div>
      {showSelfPreview && local && (
        <div className="absolute bottom-6 right-6 h-28 w-44 shadow-[0_8px_24px_rgba(16,42,67,0.28)]">
          <ParticipantTile id={local.id} participant={local.participant} name={local.name} isLocal isSpeaking={local.isSpeaking} />
        </div>
      )}
    </div>
  );
}
