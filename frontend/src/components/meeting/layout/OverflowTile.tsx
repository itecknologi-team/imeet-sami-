import { InitialsAvatar } from "../InitialsAvatar";
import type { LayoutParticipant } from "./types";

interface OverflowTileProps {
  overflowParticipants: LayoutParticipant[];
  onOpenParticipantList: () => void;
  className?: string;
}

// The "+N" tile shown in place of one strip/grid slot once there are more
// participants than visible slots — a cluster of overlapping avatars for the
// first few, plus a badge with the remaining count. Clicking it opens the
// full participant list rather than trying to cram a scroll UI in here.
export function OverflowTile({ overflowParticipants, onOpenParticipantList, className = "" }: OverflowTileProps) {
  const preview = overflowParticipants.slice(0, 3);
  const remaining = overflowParticipants.length;

  return (
    <button
      type="button"
      onClick={onOpenParticipantList}
      aria-label={`Show ${remaining} more participants`}
      title={`+${remaining} more`}
      className={`flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[var(--meeting-radius)] border border-brand-border bg-slate-100 text-brand-text shadow-soft transition-colors hover:bg-slate-200 ${className}`}
    >
      <div className="flex items-center">
        {preview.map((p, i) => (
          <div key={p.id} className="rounded-full ring-2 ring-slate-100" style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <InitialsAvatar name={p.name} size="sm" />
          </div>
        ))}
        <span className="ml-1 flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-blue px-1.5 text-xs font-bold text-white ring-2 ring-slate-100">
          +{remaining}
        </span>
      </div>
      <span className="text-xs font-medium text-brand-muted">View all</span>
    </button>
  );
}
