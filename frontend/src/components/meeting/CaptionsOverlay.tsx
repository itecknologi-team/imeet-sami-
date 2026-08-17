import type { CaptionEntry } from "../../hooks/useMeeting";

interface CaptionsOverlayProps {
  captions: CaptionEntry[];
  language: string;
}

export function CaptionsOverlay({ captions, language }: CaptionsOverlayProps) {
  if (captions.length === 0) return null;

  return (
    <div className="space-y-1 border-t border-brand-border bg-white px-4 py-2">
      {captions.map((c) => (
        <p key={c.id} className="truncate text-sm text-brand-text">
          <span className="font-medium text-brand-text">{c.name}: </span>
          {c.translations[language] ?? c.sourceText}
        </p>
      ))}
    </div>
  );
}
