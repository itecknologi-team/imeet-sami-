import { useLayoutEngine } from "../../../hooks/useLayoutEngine";
import { ParticipantTile } from "./ParticipantTile";
import { OverflowTile } from "./OverflowTile";
import type { LayoutParticipant } from "./types";

interface TiledLayoutProps {
  participants: LayoutParticipant[];
  maxTiles: number;
  pinnedId: string | null;
  onSpotlight: (id: string) => void;
  onOpenParticipantList: () => void;
}

// Equal-sized tiles, auto-fit rows/columns for the container — all
// participants treated equally (no stage). Overflow beyond maxTiles
// collapses into a single +N tile occupying one grid slot.
export function TiledLayout({ participants, maxTiles, pinnedId, onSpotlight, onOpenParticipantList }: TiledLayoutProps) {
  const { containerRef, columns, rows, visibleCount, overflowCount } = useLayoutEngine(participants.length, maxTiles);
  const visible = participants.slice(0, visibleCount);
  const overflow = participants.slice(visibleCount);

  return (
    <div ref={containerRef} className="flex min-h-0 w-full flex-1 items-center justify-center rounded-2xl bg-[#F4F7FA] p-3">
      <div
        className="grid h-full w-full gap-[var(--meeting-gap)]"
        // Rows need an explicit size too, not just columns — left as `auto`,
        // each row would size itself from its own content, so a row holding
        // only a camera-off tile (whose content is just a small centered
        // avatar circle) would end up shorter than a row with real video.
        // minmax(0, 1fr) on both axes forces every cell to the same size.
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {visible.map((p) => (
          <div key={p.id} className="meeting-layout-transition h-full min-h-0 w-full">
            <ParticipantTile
              id={p.id}
              participant={p.participant}
              name={p.name}
              isLocal={p.isLocal}
              isSpeaking={p.isSpeaking}
              isPinned={pinnedId === p.id}
              videoSource={p.videoSource}
              onSpotlight={onSpotlight}
            />
          </div>
        ))}
        {overflowCount > 0 && (
          <div className="h-full min-h-0 w-full">
            <OverflowTile overflowParticipants={overflow} onOpenParticipantList={onOpenParticipantList} />
          </div>
        )}
      </div>
    </div>
  );
}
