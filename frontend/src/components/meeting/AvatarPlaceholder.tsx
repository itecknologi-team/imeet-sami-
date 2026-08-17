const SKIN = "#eab892";
const HAIR = "#2f2013";
const BODY = "#2563eb";

export function AvatarPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gray-800">
      <svg viewBox="0 0 120 120" className="h-20 w-20 animate-avatar-float sm:h-28 sm:w-28" aria-hidden="true">
        <path d="M22 118c0-26 15-36 38-36s38 10 38 36Z" fill={BODY} />
        <rect x="50" y="58" width="20" height="18" fill={SKIN} />
        <circle cx="60" cy="44" r="30" fill={HAIR} />
        <circle cx="60" cy="47" r="25" fill={SKIN} />
      </svg>
    </div>
  );
}
