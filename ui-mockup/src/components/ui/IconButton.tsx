import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
  active?: boolean;
  variant?: "light" | "dark" | "danger";
  size?: "sm" | "md" | "lg";
  badge?: number;
}

const SIZE_CLASSES: Record<NonNullable<IconButtonProps["size"]>, string> = {
  sm: "h-9 w-9",
  md: "h-11 w-11",
  lg: "h-16 w-16",
};

export function IconButton({
  icon,
  label,
  active = false,
  variant = "light",
  size = "md",
  badge,
  className = "",
  ...rest
}: IconButtonProps) {
  const base =
    "relative inline-flex items-center justify-center rounded-full transition-colors focus-ring border";

  let variantClasses = "";
  if (variant === "danger") {
    variantClasses = "bg-danger border-danger text-white hover:bg-red-600";
  } else if (variant === "dark") {
    variantClasses = active
      ? "bg-brand-blue/90 border-brand-blue text-white"
      : "bg-black/40 border-white/10 text-white hover:bg-black/55 backdrop-blur-sm";
  } else {
    variantClasses = active
      ? "bg-brand-blue/10 border-brand-blue/30 text-brand-blue"
      : "bg-white border-border text-text hover:bg-slate-50";
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`${base} ${SIZE_CLASSES[size]} ${variantClasses} ${className}`}
      {...rest}
    >
      {icon}
      {typeof badge === "number" && badge > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[10px] font-semibold leading-none text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
