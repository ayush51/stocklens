import Link from "next/link";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="brand-mark-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#brand-mark-gradient)" />
      <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.5" />
      <path
        d="M10.5 15.5l2.5-2.5 2 1.5 2.5-3"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M19 19l5.5 5.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

export function BrandLogo({ href = "/dashboard" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="focus-visible:ring-ring flex items-center gap-2 rounded-md text-lg font-semibold outline-none focus-visible:ring-2"
    >
      <BrandMark className="size-7" />
      StockLens
    </Link>
  );
}
