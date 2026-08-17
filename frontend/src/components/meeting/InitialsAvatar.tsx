const PALETTE = ["#0a5ca8", "#00a19a", "#4caf3f", "#ef8f1c", "#c0be3a", "#00a9ce"];

function colorFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

// Strips a trailing "(You)"-style suffix (used for the local participant's
// own tile) so it never affects initials or the color hash — otherwise the
// same person would get a different avatar color in the camera tile (name
// includes "(You)") than in the participant list (plain name).
function stripSuffix(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function initialsFor(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface InitialsAvatarProps {
  name: string;
  size?: "sm" | "md" | "xl";
}

const SIZE_CLASSES: Record<NonNullable<InitialsAvatarProps["size"]>, string> = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-sm",
  xl: "h-20 w-20 text-2xl shadow-[0_8px_24px_rgba(0,0,0,0.25)] sm:h-28 sm:w-28 sm:text-4xl",
};

export function InitialsAvatar({ name, size = "md" }: InitialsAvatarProps) {
  const cleaned = stripSuffix(name);
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-white ${SIZE_CLASSES[size]}`}
      style={{ backgroundColor: colorFor(cleaned) }}
      aria-hidden="true"
    >
      {initialsFor(cleaned)}
    </span>
  );
}
