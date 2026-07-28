import Link from "next/link";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            ThesisTrack
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              Pricing
            </Link>
            <Link href="/sign-in" className="text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-border text-muted-foreground border-t px-6 py-6 text-sm">
        <div className="mx-auto max-w-5xl">© {new Date().getFullYear()} ThesisTrack</div>
      </footer>
    </div>
  );
}
