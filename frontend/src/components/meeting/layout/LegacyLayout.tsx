import { ParticipantTile } from "./ParticipantTile";
import type { LayoutParticipant } from "./types";

interface LegacyLayoutProps {
  participants: LayoutParticipant[];
  pinnedId: string | null;
  onSpotlight: (id: string) => void;
}

// A deliberately static layout: whoever's "main" stays main, everyone else
// stays in the same order in the side column — nothing reorders on speech.
// For users who find the other modes' constant reshuffling distracting.
export function LegacyLayout({ participants, pinnedId, onSpotlight }: LegacyLayoutProps) {
  if (participants.length === 0) return null;

  const mainIndex = pinnedId ? Math.max(0, participants.findIndex((p) => p.id === pinnedId)) : 0;
  const main = participants[mainIndex];
  // Stable order — deliberately NOT re-sorted by who's speaking.
  const others = participants.filter((_, i) => i !== mainIndex);

  return (
    <div className="flex min-h-0 w-full flex-1 gap-3 rounded-2xl bg-[#F4F7FA] p-3">
      <div className="min-h-0 flex-1">
        <ParticipantTile
          id={main.id}
          participant={main.participant}
          name={main.name}
          isLocal={main.isLocal}
          isSpeaking={main.isSpeaking}
          isPinned={pinnedId === main.id}
          videoSource={main.videoSource}
          variant="stage"
          onSpotlight={onSpotlight}
        />
      </div>
      {others.length > 0 && (
        <div className="meeting-scroll-strip flex w-[220px] flex-shrink-0 flex-col gap-3 overflow-y-auto">
          {others.map((p) => (
            <div key={p.id} className="aspect-[16/10] flex-shrink-0">
              <ParticipantTile
                id={p.id}
                participant={p.participant}
                name={p.name}
                isLocal={p.isLocal}
                isSpeaking={p.isSpeaking}
                isPinned={pinnedId === p.id}
                onSpotlight={onSpotlight}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
