const DOTS: { cx: number; cy: number; r: number; color: string }[] = [
  // center
  { cx: 24, cy: 24, r: 3, color: "#2563eb" },
  // vertical arm (up)
  { cx: 24, cy: 14, r: 2.6, color: "#e11d48" },
  { cx: 24, cy: 5, r: 2, color: "#f97316" },
  // vertical arm (down)
  { cx: 24, cy: 34, r: 2.6, color: "#16a34a" },
  { cx: 24, cy: 43, r: 2, color: "#0ea5e9" },
  // horizontal arm (left)
  { cx: 14, cy: 24, r: 2.6, color: "#eab308" },
  { cx: 5, cy: 24, r: 2, color: "#7c3aed" },
  // horizontal arm (right)
  { cx: 34, cy: 24, r: 2.6, color: "#0d9488" },
  { cx: 43, cy: 24, r: 2, color: "#db2777" },
  // diagonal (up-left)
  { cx: 17, cy: 17, r: 2, color: "#f59e0b" },
  // diagonal (up-right)
  { cx: 31, cy: 17, r: 2, color: "#22c55e" },
  // diagonal (down-left)
  { cx: 17, cy: 31, r: 2, color: "#3b82f6" },
  // diagonal (down-right)
  { cx: 31, cy: 31, r: 2, color: "#f43f5e" },
];

export function CompanyLogo() {
  return (
    <div className="flex items-start gap-2">
      <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true">
        {DOTS.map((d, i) => (
          <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill={d.color} />
        ))}
      </svg>
      <div className="leading-tight">
        <p className="text-lg font-semibold text-text">
          i<span className="text-brand-blue">Tecknologi</span>
        </p>
        <p className="-mt-1 text-[11px] tracking-wide text-muted">Group of Companies</p>
      </div>
    </div>
  );
}
