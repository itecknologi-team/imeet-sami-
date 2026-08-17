const STROKE = "#1e2a32";
const RUST = "#c2703d";
const YELLOW = "#f4c542";

function SceneHeadphones() {
  return (
    <svg viewBox="0 0 220 180" fill="none" aria-hidden="true" className="h-full w-full">
      {/* books */}
      <rect x="18" y="128" width="46" height="10" rx="2" stroke={STROKE} strokeWidth="2" />
      <rect x="22" y="118" width="38" height="10" rx="2" stroke={STROKE} strokeWidth="2" />
      {/* monitor */}
      <rect x="70" y="40" width="120" height="82" rx="6" stroke={STROKE} strokeWidth="2.5" />
      <rect x="82" y="52" width="96" height="58" rx="2" stroke={STROKE} strokeWidth="2" />
      <circle cx="150" cy="70" r="8" stroke={STROKE} strokeWidth="2" />
      <path d="M86 104 L112 78 L132 96 L152 70 L174 104" stroke={STROKE} strokeWidth="2" strokeLinejoin="round" />
      <rect x="118" y="122" width="24" height="10" stroke={STROKE} strokeWidth="2" />
      <rect x="98" y="132" width="64" height="8" rx="2" stroke={STROKE} strokeWidth="2" />
      {/* person */}
      <circle cx="70" cy="118" r="20" stroke={STROKE} strokeWidth="2.5" />
      <path d="M42 176 C42 148 96 148 98 176" stroke={STROKE} strokeWidth="2.5" fill={RUST} />
      {/* headphones */}
      <path d="M52 108 A18 18 0 0 1 88 108" stroke={STROKE} strokeWidth="2.5" />
      <rect x="47" y="104" width="9" height="16" rx="4" stroke={STROKE} strokeWidth="2" />
      <rect x="84" y="104" width="9" height="16" rx="4" stroke={STROKE} strokeWidth="2" />
    </svg>
  );
}

function SceneChatting() {
  return (
    <svg viewBox="0 0 220 180" fill="none" aria-hidden="true" className="h-full w-full">
      {/* speech bubble */}
      <path
        d="M118 40 h64 a8 8 0 0 1 8 8 v28 a8 8 0 0 1 -8 8 h-30 l-10 14 v-14 h-24 a8 8 0 0 1 -8 -8 v-28 a8 8 0 0 1 8 -8 z"
        stroke={STROKE}
        strokeWidth="2"
      />
      <circle cx="136" cy="62" r="3" fill={STROKE} />
      <circle cx="150" cy="62" r="3" fill={STROKE} />
      <circle cx="164" cy="62" r="3" fill={STROKE} />
      {/* left person (seated, listening) */}
      <circle cx="60" cy="96" r="18" stroke={STROKE} strokeWidth="2.5" />
      <path d="M34 176 C34 138 86 138 88 176" stroke={STROKE} strokeWidth="2.5" fill={YELLOW} />
      {/* right person (talking) */}
      <circle cx="150" cy="108" r="18" stroke={STROKE} strokeWidth="2.5" />
      <path d="M124 176 C124 140 176 140 178 176" stroke={STROKE} strokeWidth="2.5" fill={RUST} />
      {/* small table */}
      <line x1="34" y1="150" x2="178" y2="150" stroke={STROKE} strokeWidth="2" />
    </svg>
  );
}

function ScenePresenting() {
  return (
    <svg viewBox="0 0 220 180" fill="none" aria-hidden="true" className="h-full w-full">
      {/* board */}
      <rect x="86" y="24" width="118" height="88" rx="6" stroke={STROKE} strokeWidth="2.5" />
      <circle cx="128" cy="64" r="22" stroke={STROKE} strokeWidth="2" />
      <path d="M128 42 A22 22 0 0 1 148 76" stroke={STROKE} strokeWidth="2" fill={RUST} />
      <path d="M128 64 L128 42" stroke={STROKE} strokeWidth="1.5" />
      <path d="M128 64 L148 76" stroke={STROKE} strokeWidth="1.5" />
      <rect x="160" y="76" width="10" height="20" stroke={STROKE} strokeWidth="2" />
      <rect x="174" y="64" width="10" height="32" stroke={STROKE} strokeWidth="2" />
      <rect x="188" y="52" width="10" height="44" stroke={STROKE} strokeWidth="2" />
      {/* presenter */}
      <circle cx="46" cy="90" r="19" stroke={STROKE} strokeWidth="2.5" />
      <path d="M18 176 C18 140 74 140 74 176" stroke={STROKE} strokeWidth="2.5" fill={YELLOW} />
      <path d="M64 128 L92 108" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function SceneLaptop() {
  return (
    <svg viewBox="0 0 220 180" fill="none" aria-hidden="true" className="h-full w-full">
      {/* seated person */}
      <circle cx="92" cy="60" r="19" stroke={STROKE} strokeWidth="2.5" />
      <path d="M62 108 C62 88 122 88 122 108 L130 150 L54 150 Z" stroke={STROKE} strokeWidth="2.5" fill={YELLOW} />
      <path d="M54 150 C40 158 40 172 40 176" stroke={STROKE} strokeWidth="2.5" />
      <path d="M130 150 C144 158 144 172 144 176" stroke={STROKE} strokeWidth="2.5" />
      {/* laptop */}
      <path d="M56 150 L128 150 L136 168 L48 168 Z" stroke={STROKE} strokeWidth="2.5" />
      <rect x="66" y="122" width="52" height="30" rx="3" stroke={STROKE} strokeWidth="2.5" />
      <path
        d="M92 128 c1.5 -3 4.5 -4 6 -1.5 c1.5 -2.5 4.5 -1.5 4.5 1.5 c0 3 -5.5 6.5 -5.5 6.5 s-5.5 -3.5 -5.5 -6.5 c0 -1.8 0.7 -2.7 0.5 0z"
        fill={STROKE}
      />
      {/* trash can */}
      <path d="M168 140 L176 176 L200 176 L206 140 Z" stroke={STROKE} strokeWidth="2" />
      <line x1="164" y1="140" x2="210" y2="140" stroke={STROKE} strokeWidth="2" />
      <line x1="182" y1="132" x2="192" y2="132" stroke={STROKE} strokeWidth="2" />
    </svg>
  );
}

export function HeroIllustration() {
  return (
    <div>
      <div className="grid grid-cols-2 gap-6">
        <div className="aspect-[11/9]">
          <SceneHeadphones />
        </div>
        <div className="aspect-[11/9]">
          <SceneChatting />
        </div>
        <div className="aspect-[11/9]">
          <ScenePresenting />
        </div>
        <div className="aspect-[11/9]">
          <SceneLaptop />
        </div>
      </div>
      <p className="mt-6 text-sm text-muted">
        You&apos;re in the picture — camera and mic are live.{" "}
        <a href="#" className="font-medium text-brand-blue underline underline-offset-2">
          Full preview
        </a>
      </p>
    </div>
  );
}
