import { Mic, MicOff, MonitorUp, MoreHorizontal } from "lucide-react";
import type { Participant } from "../../data/mockData";
import { IconButton } from "../ui/IconButton";

interface ParticipantsPanelProps {
  participants: Participant[];
}

export function ParticipantsPanel({ participants }: ParticipantsPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text">Participants</h2>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-orange px-1.5 text-[11px] font-bold text-white">
            {participants.length}
          </span>
        </div>
        <IconButton icon={<MoreHorizontal className="h-4 w-4" />} label="Participants menu" size="sm" />
      </div>

      <ul className="max-h-64 divide-y divide-border overflow-y-auto">
        {participants.map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
            <img
              src={`https://i.pravatar.cc/150?img=${p.avatarSeed}`}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
            <span className="flex-1 truncate text-sm text-text">{p.name}</span>
            {p.screenSharing && <MonitorUp className="h-4 w-4 text-brand-blue" aria-label="Sharing screen" />}
            {p.muted ? (
              <MicOff className="h-4 w-4 text-slate-400" aria-label={`${p.name} is muted`} />
            ) : (
              <Mic className="h-4 w-4 text-brand-blue" aria-label={`${p.name} is unmuted`} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
