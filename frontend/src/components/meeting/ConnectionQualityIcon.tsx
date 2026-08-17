import { SignalHigh, SignalLow, SignalMedium, SignalZero } from "lucide-react";
import type { ConnectionQuality } from "livekit-client";

interface ConnectionQualityIconProps {
  quality: ConnectionQuality | null;
}

export function ConnectionQualityIcon({ quality }: ConnectionQualityIconProps) {
  const label = `Connection quality: ${quality ?? "unknown"}`;

  if (quality === "excellent") {
    return <SignalHigh className="h-4 w-4 text-brand-green" aria-label={label} />;
  }
  if (quality === "good") {
    return <SignalMedium className="h-4 w-4 text-brand-olive" aria-label={label} />;
  }
  if (quality === "poor") {
    return <SignalLow className="h-4 w-4 text-brand-danger" aria-label={label} />;
  }
  return <SignalZero className="h-4 w-4 text-brand-muted" aria-label={label} />;
}
