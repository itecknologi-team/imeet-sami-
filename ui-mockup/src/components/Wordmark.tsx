interface WordmarkProps {
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<WordmarkProps["size"]>, string> = {
  sm: "text-xl",
  lg: "text-5xl sm:text-6xl",
};

export function Wordmark({ size = "lg", className = "" }: WordmarkProps) {
  return (
    <span
      className={`bg-[linear-gradient(90deg,var(--brand-cyan),var(--brand-teal),var(--brand-green),var(--brand-olive),var(--brand-orange))] bg-clip-text font-extrabold italic leading-none tracking-tight text-transparent ${SIZE_CLASSES[size]} ${className}`}
    >
      imeet
    </span>
  );
}
