import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getSignalCandidates,
  getVennOverlapCounts,
  getSignalConvergenceSummary,
  getPricesForCandidates,
  type SignalWindow,
} from "@/features/signal-convergence/server/queries";
import { getDataHealthSnapshot } from "@/features/signal-convergence/server/data-health";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { SignalTabs } from "@/features/signal-convergence/components/signal-tabs";
import { WindowSelector } from "@/features/signal-convergence/components/window-selector";
import { SignalSummaryMetrics } from "@/features/signal-convergence/components/summary-metrics";
import { SignalVennDiagram, type VennCategory } from "@/features/signal-convergence/components/venn-diagram";
import { CandidateTable } from "@/features/signal-convergence/components/candidate-table";
import { SignalConvergenceDisclaimer } from "@/features/signal-convergence/components/disclaimer-banner";
import { RefreshSignalsButton } from "@/features/signal-convergence/components/refresh-button";

function parseWindow(value: string | undefined): SignalWindow {
  const n = Number(value);
  return n === 7 || n === 90 ? n : 30;
}

function filterByCategory<
  T extends { components: { insider: number; governmentContracts: number; congress: number } },
>(candidates: T[], category: VennCategory | undefined): T[] {
  if (!category) return candidates;
  return candidates.filter((c) => {
    // Scored presence, matching getVennOverlapCounts exactly — see that
    // function's own comment for why raw event counts would be wrong here.
    const i = c.components.insider > 0;
    const g = c.components.governmentContracts > 0;
    const congress = c.components.congress > 0;
    switch (category) {
      case "insiderOnly":
        return i && !g && !congress;
      case "contractsOnly":
        return !i && g && !congress;
      case "congressOnly":
        return !i && !g && congress;
      case "insiderAndContracts":
        return i && g && !congress;
      case "insiderAndCongress":
        return i && !g && congress;
      case "contractsAndCongress":
        return !i && g && congress;
      case "allThree":
        return i && g && congress;
      default:
        return true;
    }
  });
}

export default async function SignalConvergencePage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; category?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const params = await searchParams;
  const window = parseWindow(params.window);
  const category = params.category as VennCategory | undefined;

  const [candidates, vennCounts, summary, health] = await Promise.all([
    getSignalCandidates(window),
    getVennOverlapCounts(window),
    getSignalConvergenceSummary(window),
    getDataHealthSnapshot(),
  ]);

  const filteredCandidates = filterByCategory(candidates, category);
  const prices = await getPricesForCandidates(filteredCandidates.map((c) => c.ticker));

  const sourcesHealthy = health.filter((h) => !h.isStale && h.providerKind === "official").length;
  const officialSourceCount = health.filter((h) => h.providerKind === "official").length;
  const lastRefresh = health
    .map((h) => h.lastSuccessfulRun?.completedAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="Research candidates where government contracts, congressional trades, and insider transactions appear together in the same window — not investment advice."
        actions={<RefreshSignalsButton />}
      />
      <SignalTabs />

      <div className="flex items-center justify-between">
        <WindowSelector current={window} />
      </div>

      <SignalSummaryMetrics
        summary={summary}
        sourcesHealthy={sourcesHealthy}
        sourcesTotal={officialSourceCount}
        lastRefresh={lastRefresh ? lastRefresh.toLocaleString() : null}
      />

      <SignalVennDiagram counts={vennCounts} />

      <SignalConvergenceDisclaimer />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Multi-Signal Research Candidates</h2>
        {candidates.length === 0 ? (
          <EmptyState
            title="No signals yet"
            description="Either no data has been ingested yet (try Refresh now), or no tracked company has a qualifying event in this window."
          />
        ) : (
          <CandidateTable candidates={filteredCandidates} prices={prices} />
        )}
      </div>
    </div>
  );
}
