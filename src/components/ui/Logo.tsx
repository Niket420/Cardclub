import Link from "next/link";

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe29a" />
          <stop offset="1" stopColor="#c9922a" />
        </linearGradient>
      </defs>
      <rect x="10" y="12" width="28" height="38" rx="5" fill="#2b3f86" transform="rotate(-14 24 31)" />
      <rect x="24" y="12" width="28" height="38" rx="5" fill="url(#lg-gold)" transform="rotate(10 38 31)" />
      <path d="M38 23c-2.8 3.6-6.4 5.6-6.4 9a3.6 3.6 0 0 0 5.8 2.9l-1.1 4.2h3.4l-1.1-4.2a3.6 3.6 0 0 0 5.8-2.9c0-3.4-3.6-5.4-6.4-9z" fill="#0b0f17" transform="rotate(10 38 31)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="Card Club home">
      <LogoMark />
      <span className="font-display text-lg font-bold tracking-tight">
        Card <span className="text-gold-400">Club</span>
      </span>
    </Link>
  );
}
