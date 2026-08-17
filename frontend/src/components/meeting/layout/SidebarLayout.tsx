import { ChevronLeft, ChevronRight } from "lucide-react";
import { Track } from "livekit-client";
import { useElementSize } from "../../../hooks/useElementSize";
import { ParticipantTile } from "./ParticipantTile";
import { OverflowTile } from "./OverflowTile";
import type { LayoutParticipant } from "./types";
import type { ScreenShareInfo } from "./FilmstripLayout";

interface SidebarLayoutProps {
  participants: LayoutParticipant[];
  stageParticipantId: string | null;
  maxTiles: number;
  pinnedId: string | null;
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
  onSpotlight: (id: string) => void;
  onOpenParticipantList: () => void;
  screenShare?: ScreenShareInfo | null;
}

const NARROW_BREAKPOINT = 900;

export function SidebarLayout({
  participants,
  stageParticipantId,
  maxTiles,
  pinnedId,
  collapsed,
  onToggleCollapsed,
  onSpotlight,
  onOpenParticipantList,
  screenShare = null,
}: SidebarLayoutProps) {
  const { ref: containerRef, width: containerWidth } = useElementSize<HTMLDivElement>();
  const isNarrow = containerWidth > 0 && containerWidth < NARROW_BREAKPOINT;

  const stageParticipant = !screenShare ? (participants.find((p) => p.id === stageParticipantId) ?? participants[0]) : undefined;
  const sidebarParticipants = screenShare ? participants : participants.filter((p) => p.id !== stageParticipant?.id);
  const visible = sidebarParticipants.slice(0, maxTiles - 1 > 0 ? maxTiles - 1 : maxTiles);
  const overflow = sidebarParticipants.slice(visible.length);

  return (
    <div
      ref={containerRef}
      className={`flex min-h-0 w-full flex-1 gap-3 rounded-2xl bg-[#F4F7FA] p-3 ${isNarrow ? "flex-col" : "flex-row"}`}
    >
      <div className="min-h-0 flex-1">
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

      {!collapsed && sidebarParticipants.length > 0 && (
        <div
          className={
            isNarrow
              ? "meeting-scroll-strip flex h-32 flex-shrink-0 gap-3 overflow-x-auto"
              : "meeting-scroll-strip flex w-1/4 min-w-[180px] flex-shrink-0 flex-col gap-3 overflow-y-auto"
          }
        >
          {visible.map((p) => (
            <div key={p.id} className={isNarrow ? "aspect-[16/10] h-full flex-shrink-0" : "aspect-[16/10] flex-shrink-0"}>
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
          {overflow.length > 0 && (
            <div className={isNarrow ? "aspect-[16/10] h-full flex-shrink-0" : "aspect-[16/10] flex-shrink-0"}>
              <OverflowTile overflowParticipants={overflow} onOpenParticipantList={onOpenParticipantList} />
            </div>
          )}
        </div>
      )}

      {!isNarrow && sidebarParticipants.length > 0 && (
        <button
          type="button"
          onClick={() => onToggleCollapsed(!collapsed)}
          aria-label={collapsed ? "Show participant sidebar" : "Collapse participant sidebar"}
          title={collapsed ? "Show sidebar" : "Collapse sidebar"}
          className="flex h-10 w-6 flex-shrink-0 items-center justify-center self-center rounded-full border border-brand-border bg-white text-brand-text shadow-soft hover:bg-slate-50"
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}
