import type { CaptionEntry } from "../../hooks/useMeeting";

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "ur", label: "Urdu" },
  { code: "hi", label: "Hindi" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
];

interface CaptionsOverlayProps {
  captions: CaptionEntry[];
  language: string;
  onLanguageChange: (language: string) => void;
}

export function CaptionsOverlay({ captions, language, onLanguageChange }: CaptionsOverlayProps) {
  return (
    <div className="flex min-h-[3rem] items-center gap-3 border-t border-gray-800 bg-gray-900 px-4 py-2">
      <select
        value={language}
        onChange={(e) => onLanguageChange(e.target.value)}
        className="rounded border border-gray-700 bg-gray-800 px-2 py-1 text-xs text-gray-100"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
      <div className="flex-1 space-y-1 overflow-hidden">
        {captions.map((c) => (
          <p key={c.id} className="truncate text-sm text-gray-200">
            <span className="font-medium text-gray-100">{c.name}: </span>
            {c.translations[language] ?? c.sourceText}
          </p>
        ))}
      </div>
    </div>
  );
}
