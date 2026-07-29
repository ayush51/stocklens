import Link from "next/link";

export function DisclaimerFooter() {
  return (
    <footer className="border-border text-muted-foreground border-t px-6 py-3 text-xs">
      Not investment advice. AI-generated content may contain errors — verify against the original source
      before relying on it. Market data may be delayed or stale; brokerage data reflects only your last manual
      sync, not a live feed.{" "}
      <Link href="/legal/disclaimer" className="hover:text-foreground underline">
        Full disclaimer
      </Link>
    </footer>
  );
}
