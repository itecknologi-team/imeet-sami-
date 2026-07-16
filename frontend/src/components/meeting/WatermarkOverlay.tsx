import { useEffect, useState } from "react";

interface WatermarkOverlayProps {
  name: string;
  email: string;
}

export function WatermarkOverlay({ name, email }: WatermarkOverlayProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const label = `${name} • ${email} • ${now.toLocaleTimeString()}`;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex select-none items-end justify-end p-2">
      <span className="rounded bg-black/40 px-2 py-1 font-mono text-[10px] text-white/70">{label}</span>
    </div>
  );
}
