interface HeroIllustrationProps {
  onOpenPreview?: () => void;
}

function FourScenes() {
  return (
    <svg
      viewBox="0 0 640 500"
      role="img"
      aria-label="Four scenes: a browser video call, people chatting, presenting a shared screen, and joining from a laptop"
      className="h-full w-full"
    >
      <defs>
        <g id="hero-mark" transform="translate(-14 -10)">
          <rect x="230" y="10" width="47" height="119" fill="#1B75BB" />
          <rect x="158" y="82" width="47" height="119" fill="#22A9A0" />
          <rect x="302" y="82" width="47" height="47" fill="#231F20" />
          <rect x="86" y="154" width="47" height="47" fill="#B01F24" />
          <rect x="230" y="154" width="191" height="47" fill="#F15A29" />
          <rect x="14" y="226" width="47" height="47" fill="#EC008C" />
          <rect x="86" y="226" width="47" height="119" fill="#3AB54A" />
          <rect x="158" y="226" width="119" height="47" fill="#92278F" />
          <rect x="302" y="226" width="47" height="119" fill="#2E3192" />
          <rect x="374" y="226" width="119" height="47" fill="#F7941E" />
          <rect x="158" y="298" width="47" height="119" fill="#29ABE2" />
          <rect x="230" y="298" width="47" height="191" fill="#1B6FB5" />
          <rect x="374" y="298" width="47" height="47" fill="#00954D" />
          <rect x="302" y="370" width="47" height="47" fill="#662D91" />
        </g>
        <clipPath id="hero-a1">
          <rect x="58" y="84" width="98" height="48" rx="6" />
        </clipPath>
        <clipPath id="hero-a2">
          <rect x="164" y="84" width="98" height="48" rx="6" />
        </clipPath>
        <clipPath id="hero-a3">
          <rect x="58" y="140" width="98" height="48" rx="6" />
        </clipPath>
      </defs>

      <rect width="640" height="500" fill="#F4F7FA" />

      <g fill="none" stroke="#2B3A42" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        {/* SCENE 1 : the imeet call, running in a browser */}
        <rect x="45" y="45" width="230" height="180" rx="11" fill="#FFFFFF" />
        <path d="M45 72 H275" strokeWidth={2.5} />
        <g strokeWidth={2}>
          <circle cx="59" cy="58.5" r="3.5" />
          <circle cx="73" cy="58.5" r="3.5" />
          <circle cx="87" cy="58.5" r="3.5" />
        </g>

        <g clipPath="url(#hero-a1)">
          <path d="M88 132 A19 19 0 0 1 126 132 Z" fill="#F2C230" />
          <circle cx="107" cy="100" r="11" fill="#FFFFFF" strokeWidth={2.5} />
        </g>
        <rect x="58" y="84" width="98" height="48" rx="6" strokeWidth={2.5} />

        <g clipPath="url(#hero-a2)">
          <path d="M194 132 A19 19 0 0 1 232 132 Z" fill="#C4622D" />
          <circle cx="213" cy="100" r="11" fill="#FFFFFF" strokeWidth={2.5} />
        </g>
        <rect x="164" y="84" width="98" height="48" rx="6" strokeWidth={2.5} />

        <g clipPath="url(#hero-a3)">
          <path d="M88 188 A19 19 0 0 1 126 188 Z" fill="#16A5B8" />
          <circle cx="107" cy="156" r="11" fill="#FFFFFF" strokeWidth={2.5} />
        </g>
        <rect x="58" y="140" width="98" height="48" rx="6" strokeWidth={2.5} />

        <rect x="164" y="140" width="98" height="48" rx="6" fill="#FFFFFF" strokeWidth={2.5} />
        <g transform="translate(194 145) scale(0.0793)" stroke="none">
          <use href="#hero-mark" />
        </g>

        <g strokeWidth={2.5}>
          <circle cx="132" cy="206" r="11" fill="#FFFFFF" />
          <rect x="128.5" y="198" width="7" height="10" rx="3.5" strokeWidth={2} />
          <path d="M125 206 a7 7 0 0 0 14 0" strokeWidth={2} />
          <path d="M132 209 V213" strokeWidth={2} />
          <circle cx="160" cy="206" r="11" fill="#FFFFFF" />
          <rect x="153" y="202" width="9" height="8" rx="2" strokeWidth={2} />
          <path d="M162 204 L167 201 V211 L162 208 Z" strokeWidth={2} />
        </g>
        <circle cx="188" cy="206" r="11" fill="#E2762F" />
        <path d="M183 208 q5 -6 10 0" stroke="#FFFFFF" strokeWidth={2.5} />

        {/* SCENE 2 : talking, chat in the meeting */}
        <circle cx="378" cy="100" r="24" fill="#FFFFFF" />
        <path d="M460 117 L446 152 L488 117" fill="#FFFFFF" />
        <rect x="428" y="45" width="150" height="72" rx="16" fill="#FFFFFF" />
        <g stroke="none">
          <circle cx="468" cy="81" r="7" fill="#1B75BB" />
          <circle cx="503" cy="81" r="7" fill="#F15A29" />
          <circle cx="538" cy="81" r="7" fill="#3AB54A" />
        </g>
        <circle cx="481" cy="149" r="23" fill="#FFFFFF" />
        <path d="M340 185 H610" />
        <path d="M352 185 A36 36 0 0 0 424 185 Z" fill="#F2C230" />
        <path d="M486 185 A36 36 0 0 0 558 185 Z" fill="#C4622D" />

        {/* SCENE 3 : presenting a shared screen */}
        <circle cx="62" cy="348" r="24" fill="#FFFFFF" />
        <path d="M110 385 L86 412" />
        <rect x="110" y="285" width="180" height="125" rx="8" fill="#FFFFFF" />
        <g transform="translate(132 312) scale(0.1378)" stroke="none">
          <use href="#hero-mark" />
        </g>
        <g strokeWidth={2.5}>
          <rect x="212" y="360" width="14" height="30" rx="2" fill="#1B75BB" />
          <rect x="234" y="345" width="14" height="45" rx="2" fill="#22A9A0" />
          <rect x="256" y="330" width="14" height="60" rx="2" fill="#3AB54A" />
        </g>
        <path d="M28 482 A45 45 0 0 1 118 482 Z" fill="#F2C230" />

        {/* SCENE 4 : joining from a laptop */}
        <path d="M398 452 V400 a62 50 0 0 1 124 0 V452" fill="#FFFFFF" />
        <circle cx="460" cy="310" r="27" fill="#FFFFFF" />
        <path d="M431 306 A29 29 0 0 1 489 306" strokeWidth={2.5} />
        <rect x="425" y="302" width="12" height="21" rx="6" fill="#FFFFFF" strokeWidth={2.5} />
        <rect x="483" y="302" width="12" height="21" rx="6" fill="#FFFFFF" strokeWidth={2.5} />
        <path d="M489 320 C498 336 484 344 472 340" strokeWidth={2.5} />
        <rect x="428" y="408" width="64" height="44" rx="7" fill="#F2C230" />
        <path d="M388 452 H568" />
        <path d="M534 418 h26 v26 a5 5 0 0 1 -5 5 h-16 a5 5 0 0 1 -5 -5 Z" fill="#FFFFFF" strokeWidth={2.5} />
        <path d="M560 424 a9 9 0 0 1 0 14" strokeWidth={2.5} />
      </g>
    </svg>
  );
}

export function HeroIllustration({ onOpenPreview }: HeroIllustrationProps) {
  return (
    <div>
      <div className="aspect-[640/500]">
        <FourScenes />
      </div>
      <p className="mt-6 text-sm text-brand-muted">
        You&apos;re in the picture — camera and mic are live.{" "}
        <button
          type="button"
          onClick={onOpenPreview}
          className="font-medium text-brand-blue underline underline-offset-2"
        >
          Full preview
        </button>
      </p>
    </div>
  );
}
