import { useEffect, useState } from "react";

interface RecordingIndicatorProps {
  startedAt: string | null;
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

export function RecordingIndicator({ startedAt }: RecordingIndicatorProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-danger/30 bg-brand-danger/10 px-3 py-1 text-xs font-semibold text-brand-danger">
      <span className="relative flex h-2 w-2 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-danger opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-danger" />
      </span>
      REC{startedAt && <span className="font-mono">{formatElapsed(now - new Date(startedAt).getTime())}</span>}
    </span>
  );
}
