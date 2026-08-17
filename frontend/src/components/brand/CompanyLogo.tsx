import logoUrl from "../../assets/itecknologi-logo.png";

export function CompanyLogo() {
  return (
    <div className="inline-flex flex-col items-start">
      <img src={logoUrl} alt="iTecknologi" className="h-7 w-auto sm:h-8" />
      <p className="mt-0.5 text-[11px] tracking-wide text-brand-muted">Group of Companies</p>
    </div>
  );
}
