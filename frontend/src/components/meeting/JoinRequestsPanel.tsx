import { Check, X } from "lucide-react";
import type { JoinRequestEntry } from "../../hooks/useMeeting";
import { InitialsAvatar } from "./InitialsAvatar";

interface JoinRequestsPanelProps {
  requests: JoinRequestEntry[];
  onRespond: (requestId: string, approve: boolean) => void;
}

export function JoinRequestsPanel({ requests, onRespond }: JoinRequestsPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
      <div className="flex items-center gap-2 rounded-t-2xl bg-brand-blue px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Waiting to join</h2>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white">
          {requests.length}
        </span>
      </div>
      {requests.length === 0 ? (
        <p className="flex-1 px-4 py-6 text-center text-sm text-brand-muted">No one is waiting right now.</p>
      ) : (
        <ul className="flex-1 divide-y divide-brand-border overflow-y-auto">
          {requests.map((r) => (
            <li key={r.requestId} className="flex items-center gap-3 px-4 py-2.5">
              <InitialsAvatar name={r.name} size="sm" />
              <span className="flex-1 truncate text-sm text-brand-text">{r.name}</span>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
