import { Wordmark } from "../Wordmark";
import { CompanyLogo } from "./CompanyLogo";
import { HeroIllustration } from "./HeroIllustration";
import { MeetingForm } from "./MeetingForm";

interface LoginPageProps {
  onSubmit: () => void;
}

export function LoginPage({ onSubmit }: LoginPageProps) {
  return (
    <div className="page-bg flex min-h-screen flex-col">
      <div className="px-6 pt-6 sm:px-12">
        <CompanyLogo />
      </div>

      <main className="flex flex-1 flex-col items-center gap-16 px-6 py-10 sm:px-12 md:flex-row md:items-center md:justify-center">
        <div className="w-full max-w-md md:mt-0">
          <HeroIllustration />
        </div>

        <div className="w-full max-w-md">
          <Wordmark size="lg" />
          <p className="mt-4 max-w-sm text-base text-muted">
            Secure video meetings right in your browser — no downloads, no accounts.
          </p>

          <div className="mt-6">
            <MeetingForm onSubmit={onSubmit} />
          </div>
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-muted">
        A product of <span className="font-semibold text-text">iTecknologi Group</span>
      </footer>
    </div>
  );
}
