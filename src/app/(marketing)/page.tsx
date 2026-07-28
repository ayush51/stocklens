import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-balance">
        Track the thesis behind every position.
      </h1>
      <p className="text-muted-foreground mt-4 text-lg text-balance">
        ThesisTrack connects your portfolio to the research behind it — filings, earnings, and
        the reasoning you wrote down before the market moved. Works with any publicly traded
        company.
      </p>
      <div className="mt-8 flex items-center justify-center gap-3">
        <Link
          href="/sign-up"
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        >
          Get started
        </Link>
        <Link href="/sign-in" className="text-sm font-medium hover:underline">
          Sign in
        </Link>
      </div>
    </div>
  );
}
