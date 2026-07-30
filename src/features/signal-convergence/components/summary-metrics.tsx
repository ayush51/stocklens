import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SignalConvergenceSummary } from "@/features/signal-convergence/server/queries";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-xs font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function SignalSummaryMetrics({
  summary,
  sourcesHealthy,
  sourcesTotal,
  lastRefresh,
}: {
  summary: SignalConvergenceSummary;
  sourcesHealthy: number;
  sourcesTotal: number;
  lastRefresh: string | null;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <StatCard label="Companies with a signal" value={summary.companiesWithAnySignal} />
      <StatCard label="Match 2 categories" value={summary.companiesWithTwoCategories} />
      <StatCard label="Match all 3 categories" value={summary.companiesWithThreeCategories} />
      <StatCard label="New signals today" value={summary.newSignalsToday} />
      <StatCard label="Sources healthy" value={`${sourcesHealthy}/${sourcesTotal}`} />
      <StatCard label="Last refresh" value={lastRefresh ?? "Never"} />
    </div>
  );
}
