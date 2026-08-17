import { Check, UserPlus, X } from "lucide-react";
import type { JoinRequestEntry } from "../../hooks/useMeeting";
import { InitialsAvatar } from "./InitialsAvatar";

interface JoinRequestPopupProps {
  requests: JoinRequestEntry[];
  onRespond: (requestId: string, approve: boolean) => void;
}

// A dedicated, hard-to-miss popup for incoming join requests — separate from
// the small auto-dismissing toast and the side panel (which the host has to
// open on their own), so the host always sees it and can act immediately.
export function JoinRequestPopup({ requests, onRespond }: JoinRequestPopupProps) {
  if (requests.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-16 z-[60] flex w-80 flex-col gap-2.5">
      {requests.map((r) => (
        <div
          key={r.requestId}
          className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-brand-border bg-white p-3 shadow-[0_12px_32px_rgba(16,42,67,0.18)]"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-brand-blue">
            <UserPlus className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <InitialsAvatar name={r.name} size="sm" />
              <span className="truncate text-sm font-semibold text-brand-text">{r.name}</span>
            </div>
            <p className="mt-0.5 text-xs text-brand-muted">wants to join the meeting</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => onRespond(r.requestId, true)}
              aria-label={`Admit ${r.name}`}
              title="Admit"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-green/10 text-brand-green hover:bg-brand-green/20"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onRespond(r.requestId, false)}
              aria-label={`Deny ${r.name}`}
              title="Deny"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-danger/10 text-brand-danger hover:bg-brand-danger/20"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
