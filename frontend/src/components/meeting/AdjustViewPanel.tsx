import { useEffect, useId, useRef, useState } from "react";
import { Focus, LayoutGrid, PanelRight, Rows3, Sparkles, X } from "lucide-react";
import { MAX_TILES_STOPS } from "../../lib/adjustViewSettings";
import type { LayoutMode, MaxTilesStop } from "../../lib/adjustViewSettings";

interface AdjustViewPanelProps {
  open: boolean;
  onClose: () => void;
  mode: LayoutMode;
  onModeChange: (mode: LayoutMode) => void;
  maxTiles: MaxTilesStop;
  onMaxTilesChange: (value: MaxTilesStop) => void;
  deviceNote: string | null;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

const MODES: Array<{ value: LayoutMode; label: string; helper: string; Icon: typeof Sparkles }> = [
  {
    value: "auto",
    label: "Auto (Dynamic)",
    helper: "Picks the best layout automatically as people join, leave, present, or speak.",
    Icon: Sparkles,
  },
  {
    value: "tiled",
    label: "Tiled",
    helper: "Equal-sized tiles for everyone, arranged to fill the screen.",
    Icon: LayoutGrid,
  },
  {
    value: "legacy",
    label: "Legacy",
    helper: "One large tile plus a fixed side column that never reorders on speech.",
    Icon: Rows3,
  },
  {
    value: "spotlight",
    label: "Spotlight",
    helper: "One participant fills the whole stage, with a small self-preview.",
    Icon: Focus,
  },
  {
    value: "sidebar",
    label: "Sidebar",
    helper: "A large main stage with a collapsible thumbnail sidebar.",
    Icon: PanelRight,
  },
];

const MODE_LABELS: Record<LayoutMode, string> = Object.fromEntries(MODES.map((m) => [m.value, m.label])) as Record<
  LayoutMode,
  string
>;

export function AdjustViewPanel({
  open,
  onClose,
  mode,
  onModeChange,
  maxTiles,
  onMaxTilesChange,
  deviceNote,
  triggerRef,
}: AdjustViewPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [announcement, setAnnouncement] = useState("");

  // Focus trap + restore-on-close + Esc-to-close.
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      triggerRef.current?.focus();
    };
  }, [open, onClose, triggerRef]);

  function handleModeSelect(next: LayoutMode) {
    onModeChange(next);
    setAnnouncement(`Layout changed to ${MODE_LABELS[next]}`);
  }

  function handleRadioKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      const next = MODES[(index + 1) % MODES.length];
      handleModeSelect(next.value);
      (panelRef.current?.querySelectorAll('[role="radio"]')[
        (index + 1) % MODES.length
      ] as HTMLElement | undefined)?.focus();
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      const prevIndex = (index - 1 + MODES.length) % MODES.length;
      handleModeSelect(MODES[prevIndex].value);
      (panelRef.current?.querySelectorAll('[role="radio"]')[prevIndex] as HTMLElement | undefined)?.focus();
    }
  }

  if (!open) return null;

  const stopIndex = MAX_TILES_STOPS.indexOf(maxTiles);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-2xl border border-brand-border bg-brand-surface shadow-soft sm:inset-y-0 sm:right-0 sm:left-auto sm:bottom-auto sm:h-full sm:max-h-none sm:w-96 sm:rounded-none sm:rounded-l-2xl"
      >
        <div className="flex items-center justify-between border-b border-brand-border px-5 py-4">
          <h2 id={headingId} className="text-base font-semibold text-brand-text">
            Adjust View
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Adjust View"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-border bg-white text-brand-text hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div role="radiogroup" aria-label="Layout mode" className="flex flex-col gap-2">
            {MODES.map(({ value, label, helper, Icon }, index) => {
              const checked = mode === value;
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  tabIndex={checked ? 0 : -1}
                  onClick={() => handleModeSelect(value)}
                  onKeyDown={(e) => handleRadioKeyDown(e, index)}
                  title={label}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 ${
                    checked
                      ? "border-brand-blue bg-brand-blue/5"
                      : "border-brand-border bg-white hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${
                      checked ? "bg-brand-blue text-white" : "bg-slate-100 text-brand-text"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-brand-text">{label}</span>
                    <span className="mt-0.5 block text-xs text-brand-muted">{helper}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 border-t border-brand-border pt-4">
            <label htmlFor="max-tiles-slider" className="block text-sm font-medium text-brand-text">
              Maximum tiles
            </label>
            <p className="mt-1 text-xs text-brand-muted" aria-live="polite">
              Show up to {maxTiles} tiles
            </p>
            <input
              id="max-tiles-slider"
              type="range"
              min={0}
              max={MAX_TILES_STOPS.length - 1}
              step={1}
              value={stopIndex === -1 ? 0 : stopIndex}
              onChange={(e) => onMaxTilesChange(MAX_TILES_STOPS[Number(e.target.value)])}
              aria-valuetext={`Show up to ${maxTiles} tiles`}
              className="mt-2 w-full accent-[var(--meeting-accent)] focus-visible:outline-2 focus-visible:outline-brand-blue"
            />
            <div className="mt-1 flex justify-between text-[10px] text-brand-muted" aria-hidden="true">
              {MAX_TILES_STOPS.map((stop) => (
                <span key={stop}>{stop}</span>
              ))}
            </div>
            {deviceNote && <p className="mt-2 text-xs text-brand-orange">{deviceNote}</p>}
          </div>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </>
  );
}
