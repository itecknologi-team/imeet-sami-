import type { HostControlSettings } from "../../hooks/useMeeting";

interface HostControlsPanelProps {
  settings: HostControlSettings;
  onChange: (patch: Partial<HostControlSettings>) => void;
}

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: (next: boolean) => void;
}

function ToggleRow({ label, description, checked, onToggle }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-brand-text">{label}</p>
        <p className="mt-0.5 text-xs text-brand-muted">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onToggle(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
          checked ? "bg-brand-blue" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute left-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

// The host's single place to delegate moderation/media powers to everyone
// else in the meeting — every row here maps 1:1 to a permission the backend
// actually enforces (realtime/events.ts), not just a client-side hint.
export function HostControlsPanel({ settings, onChange }: HostControlsPanelProps) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-border bg-brand-surface shadow-soft">
      <div className="rounded-t-2xl bg-brand-blue px-4 py-3">
        <h2 className="text-sm font-semibold text-white">Host controls</h2>
      </div>
      <div className="flex-1 divide-y divide-brand-border overflow-y-auto">
        <ToggleRow
          label="Admit or remove participants"
          description="Let anyone in the meeting admit waiting guests or remove other participants."
          checked={settings.participantsCanAdmitOrRemove}
          onToggle={(next) => onChange({ participantsCanAdmitOrRemove: next })}
        />
        <ToggleRow
          label="Mute each other"
          description="Let participants mute someone else's microphone (never yours, and it's a one-way mute)."
          checked={settings.participantsCanMuteOthers}
          onToggle={(next) => onChange({ participantsCanMuteOthers: next })}
        />
        <ToggleRow
          label="Control their own mic and camera"
          description="Turn this off to lock everyone's mic and camera until you turn it back on."
          checked={settings.participantsCanControlOwnMedia}
          onToggle={(next) => onChange({ participantsCanControlOwnMedia: next })}
        />
        <ToggleRow
          label="Present to the call"
          description="Let participants share their screen."
          checked={settings.participantsCanPresent}
          onToggle={(next) => onChange({ participantsCanPresent: next })}
        />
        <ToggleRow
          label="Send chat messages"
          description="Let participants send messages in the meeting chat."
          checked={settings.participantsCanChat}
          onToggle={(next) => onChange({ participantsCanChat: next })}
        />
        <ToggleRow
          label="Send reactions"
          description="Let participants send emoji reactions during the call."
          checked={settings.participantsCanReact}
          onToggle={(next) => onChange({ participantsCanReact: next })}
        />
      </div>
    </div>
  );
}
