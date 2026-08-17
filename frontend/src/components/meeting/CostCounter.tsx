import { useEffect, useState } from "react";

interface CostCounterProps {
  hourlyRate: number;
  startedAt: string | null;
  participantCount: number;
}

export function CostCounter({ hourlyRate, startedAt, participantCount }: CostCounterProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  if (!startedAt || !hourlyRate) {
    return null;
  }

  const elapsedHours = Math.max(0, now - new Date(startedAt).getTime()) / 1000 / 3600;
  const cost = hourlyRate * participantCount * elapsedHours;

  return (
    <span className="font-mono text-sm text-brand-green">
      ${cost.toFixed(2)}
      <span className="ml-1 text-xs text-brand-muted">
        (${hourlyRate}/hr × {participantCount})
      </span>
    </span>
  );
}
