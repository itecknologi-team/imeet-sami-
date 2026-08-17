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
      className={`bg-[linear-gradient(90deg,var(--color-brand-cyan),var(--color-brand-teal),var(--color-brand-green),var(--color-brand-olive),var(--color-brand-orange))] bg-clip-text font-extrabold italic leading-none tracking-tight text-transparent ${SIZE_CLASSES[size]} ${className}`}
    >
      imeet
    </span>
  );
}
