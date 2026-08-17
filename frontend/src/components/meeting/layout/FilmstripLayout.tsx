import { useMemo, useRef } from "react";
import { Track } from "livekit-client";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";
import { useElementSize } from "../../../hooks/useElementSize";
import { ParticipantTile } from "./ParticipantTile";
import { OverflowTile } from "./OverflowTile";
import type { LayoutParticipant } from "./types";

export interface ScreenShareInfo {
  participant: LocalParticipant | RemoteParticipant;
  name: string;
}

interface FilmstripLayoutProps {
  participants: LayoutParticipant[];
  stageParticipantId: string | null;
  activeSpeakerId: string | null;
  maxTiles: number;
  pinnedId: string | null;
  onSpotlight: (id: string) => void;
  onOpenParticipantList: () => void;
  screenShare?: ScreenShareInfo | null;
}

const MIN_STRIP_TILE_WIDTH = 90;
const STRIP_GAP = 12;
const MAX_STRIP_SLOTS = 4;

// The default look for Auto mode with 3+ participants: a thumbnail strip on
// top, one large tile (the stage) below.
export function FilmstripLayout({
  participants,
  stageParticipantId,
  activeSpeakerId,
  maxTiles,
  pinnedId,
  onSpotlight,
  onOpenParticipantList,
  screenShare = null,
}: FilmstripLayoutProps) {
  const { ref: stripRef, width: stripWidth } = useElementSize<HTMLDivElement>();
  const stageRef = useRef<HTMLDivElement>(null);

  const stageParticipant = !screenShare
    ? (participants.find((p) => p.id === stageParticipantId) ?? participants[0])
    : undefined;

  // Screen share always wins the stage; when there's no share, whoever's on
  // stage still keeps a strip thumbnail too, so the room doesn't lose their
  // tile just because they're being spotlighted.
  const stripParticipants = screenShare ? participants : participants.filter((p) => p.id !== stageParticipant?.id);

  const slots = Math.max(
    1,
    Math.min(Math.floor((stripWidth + STRIP_GAP) / (MIN_STRIP_TILE_WIDTH + STRIP_GAP)) || 1, maxTiles, MAX_STRIP_SLOTS),
  );

  const { visible, overflow } = useMemo(() => {
    if (stripParticipants.length <= slots) {
      return { visible: stripParticipants, overflow: [] as LayoutParticipant[] };
    }
    // The active speaker (or an explicit pin) is always promoted into a
    // visible slot, even if they'd otherwise land in overflow.
    const priorityId = pinnedId ?? activeSpeakerId;
    const priorityIndex = priorityId ? stripParticipants.findIndex((p) => p.id === priorityId) : -1;
    const ordered =
      priorityIndex > 0
        ? [
            stripParticipants[priorityIndex],
            ...stripParticipants.slice(0, priorityIndex),
            ...stripParticipants.slice(priorityIndex + 1),
          ]
        : stripParticipants;
    const visibleCount = slots - 1; // one slot reserved for the overflow tile
    return { visible: ordered.slice(0, visibleCount), overflow: ordered.slice(visibleCount) };
  }, [stripParticipants, slots, pinnedId, activeSpeakerId]);

  function handleExpand() {
    stageRef.current?.requestFullscreen().catch(() => undefined);
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-3 rounded-2xl bg-[#F4F7FA] p-3">
      <div
        ref={stripRef}
        className="meeting-scroll-strip flex flex-shrink-0 gap-3 overflow-x-auto"
        style={{ height: "22%", minHeight: 90 }}
      >
        {visible.map((p) => (
          <div key={p.id} className="meeting-layout-transition aspect-[16/10] h-full flex-shrink-0">
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
        {/* Overflow tile occupies the last slot when present. */}
        {overflow.length > 0 && (
          <div className="aspect-[16/10] h-full flex-shrink-0">
            <OverflowTile overflowParticipants={overflow} onOpenParticipantList={onOpenParticipantList} />
          </div>
        )}
      </div>

      <div
        ref={stageRef}
        className="meeting-stage-enter min-h-0 flex-1"
        key={screenShare ? "screen-share" : (stageParticipant?.id ?? "empty")}
      >
        {screenShare ? (
          <ParticipantTile
            id={screenShare.participant.identity}
            participant={screenShare.participant}
            name={screenShare.name}
            videoSource={Track.Source.ScreenShare}
            variant="stage"
            onExpand={handleExpand}
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
            onExpand={handleExpand}
            onSpotlight={onSpotlight}
          />
        ) : (
          <div className="flex h-full items-center justify-center rounded-[var(--meeting-radius-lg)] border border-brand-border bg-white text-sm text-brand-muted">
            Waiting for others to join
          </div>
        )}
      </div>
    </div>
  );
}
