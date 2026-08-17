import { Film } from "lucide-react";
import { ACTIVE_VIEWS, VIEW_ICONS, VIEW_LABELS } from "../../lib/meetingViews";
import type { ActiveView } from "../../lib/meetingViews";

interface IconRailProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  isHost: boolean;
  onNotify: (message: string) => void;
}

export function IconRail({ activeView, onChangeView, isHost, onNotify }: IconRailProps) {
  // Whiteboard/code/virtual-office are host-only tools — everyone else can
  // still be shown their content (the shared-view broadcast), but can't
  // switch into them, so there's no point offering the icon at all.
  const visibleViews = isHost ? ACTIVE_VIEWS : ACTIVE_VIEWS.filter((view) => view === "video");

  return (
    <div className="flex w-[72px] flex-shrink-0 flex-col items-center justify-center gap-2.5 overflow-y-auto bg-white py-2.5 pl-3 sm:w-[96px] sm:gap-4 sm:py-4 sm:pl-4">
      <div className="flex flex-shrink-0 flex-col items-center gap-1.5 rounded-full border border-brand-border p-1.5 sm:gap-2 sm:p-2">
        <nav className="flex flex-shrink-0 flex-col gap-1.5 sm:gap-2">
          {visibleViews.map((view) => {
            const Icon = VIEW_ICONS[view];
            return (
              <button
                key={view}
                onClick={() =>
                  view === "virtual-office" ? onNotify("Virtual Office — coming soon") : onChangeView(view)
                }
                aria-label={VIEW_LABELS[view]}
                title={VIEW_LABELS[view]}
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors sm:h-14 sm:w-14 ${
                  activeView === view ? "bg-brand-blue/10 text-brand-blue" : "text-brand-text hover:bg-slate-50"
                }`}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            );
          })}
        </nav>

        <div className="h-px w-7 flex-shrink-0 bg-brand-border sm:w-8" />

        <nav className="flex flex-shrink-0 flex-col gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => onNotify("Recordings — coming soon")}
            aria-label="Recordings"
            title="Recordings"
            className="flex h-10 w-10 items-center justify-center rounded-full text-brand-text hover:bg-slate-50 sm:h-14 sm:w-14"
          >
            <Film className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </nav>
      </div>
    </div>
  );
}
