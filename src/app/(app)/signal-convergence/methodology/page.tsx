import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalTabs } from "@/features/signal-convergence/components/signal-tabs";

export default async function MethodologyPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="How the Evidence Score works, and what this feature does and doesn't claim."
      />
      <SignalTabs />

      <Card>
        <CardHeader>
          <CardTitle>What this is — and isn&apos;t</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            This is a research and discovery tool. A high Evidence Score means multiple public data sources
            happen to point at the same company in the same time window — it is not a rating, not a prediction
            of future returns, and not evidence that anyone involved had access to non-public information.
            Treat a high score as a reason to look closer, not a reason to act.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Evidence Score (0–100)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>Four components, each capped, then summed:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Insider evidence (max 35)</strong> — only open-market purchases count. Grants, gifts,
              option exercises, tax withholding, and 10b5-1/automatic transactions score zero: they&apos;re
              routine compensation activity, not a discretionary buy decision. More independent buyers and
              officer-level seniority score higher.
            </li>
            <li>
              <strong>Government-contract evidence (max 30)</strong> — only new awards and funded
              modifications count, scaled by the newly obligated amount. De-obligations and $0 administrative
              corrections never contribute — they&apos;re not a positive signal.
            </li>
            <li>
              <strong>Congressional evidence (max 20)</strong> — only disclosed purchases count. A penalty
              applies when disclosure arrives well past the STOCK Act&apos;s 45-day window.
            </li>
            <li>
              <strong>Convergence bonus (max 15)</strong> — awarded only when 2 or 3 categories qualify in the
              same window, scaled by how strong the underlying evidence actually is.
            </li>
          </ul>
          <p>
            Recency decay applies throughout: a signal from the last 14 days counts fully; older signals decay
            linearly to a 0.4 floor by 90 days. Confidence penalties apply wherever a company mapping or a
            reported value is estimated rather than exact.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entity resolution</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Government contracts and congressional disclosures report a company by name, not a ticker. Every
            automatic match records a method and a confidence score; a match below 85% confidence is never
            auto-linked — it lands in the Data Health tab&apos;s review queue instead. Confirming a review
            there also teaches the system that name for every future run.
          </p>
          <p>
            SEC insider transactions are the exception: Form 3/4/5 filings always carry the issuer&apos;s real
            CIK, so that resolution is exact.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Congressional data — real limitation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            House and Senate disclosure sites have no stable, developer-friendly API, and this app does not
            scrape past access controls or rate limits. Congressional data here comes from a real CSV import
            (see the import tool) or, for demonstration, a clearly-labeled sample fixture — never presented as
            a live official feed. Check the Data Health tab and each event&apos;s source badge before treating
            any congressional row as current.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Replacing a provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            Every data source sits behind an interface (see src/shared/contracts/*-provider.ts) — swapping
            USAspending, adding an authorized congressional data vendor, or changing the market-data provider
            never requires touching scoring, entity resolution, or the UI.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
