import { useEffect, useState } from "react";

function formatClock(date: Date): string {
  return date
    .toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(" ", "");
}

export function MeetingTimer() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span className="font-mono text-sm text-brand-muted">{formatClock(now)}</span>;
}
