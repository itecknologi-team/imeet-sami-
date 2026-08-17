import type { CSSProperties } from "react";
import type { ReactionEntry } from "../../hooks/useMeeting";

interface ReactionOverlayProps {
  reactions: ReactionEntry[];
}

export function ReactionOverlay({ reactions }: ReactionOverlayProps) {
  if (reactions.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-28 right-8 z-50 h-0 w-0">
      {reactions.map((r) => (
        <div
          key={r.id}
          className="animate-reaction-rise absolute bottom-0 right-0 flex flex-col items-center"
          style={{ "--reaction-x": `${r.offset}px` } as CSSProperties}
        >
          <span className="text-3xl drop-shadow">{r.emoji}</span>
          <span className="mt-0.5 whitespace-nowrap rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {r.name}
          </span>
        </div>
      ))}
    </div>
  );
}
