import { LayoutGrid, Mic, SignalHigh } from "lucide-react";
import { speakerChips } from "../../data/mockData";
import { IconButton } from "../ui/IconButton";

export function TopBar() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-text">
          <span className="h-2 w-2 rounded-full bg-danger" />
          Record session
        </span>
        <IconButton icon={<SignalHigh className="h-4 w-4" />} label="Connection quality" size="sm" />
        <IconButton icon={<LayoutGrid className="h-4 w-4" />} label="Layout" size="sm" />
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted">In conversation:</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {speakerChips.map((s) => (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1 text-xs font-medium text-text"
            >
              <Mic className="h-3 w-3 text-brand-blue" />
              {s.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
