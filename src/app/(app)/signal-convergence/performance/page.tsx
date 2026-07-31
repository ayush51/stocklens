import { redirect } from "next/navigation";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getSignalPerformanceHistory } from "@/features/signal-convergence/server/evaluation";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SignalTabs } from "@/features/signal-convergence/components/signal-tabs";
import { SignalConvergenceDisclaimer } from "@/features/signal-convergence/components/disclaimer-banner";

function formatPct(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function pctVariant(value: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (value === null) return "outline";
  if (value > 0) return "default";
  if (value < 0) return "destructive";
  return "secondary";
}

export default async function SignalPerformancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { rows, buckets, horizonDays, minSampleSizeForAverage } = await getSignalPerformanceHistory();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="How past Evidence Scores lined up with what actually happened to price afterward — real snapshots, real historical prices, no backtest assumptions."
      />
      <SignalTabs />
      <SignalConvergenceDisclaimer />

      <div className="border-border bg-muted/30 rounded-md border px-4 py-3 text-sm">
        <p className="text-muted-foreground">
          Every row below is a real Evidence Score snapshot this app already recorded (one per company per day
          it was viewed), paired with real historical closing prices {horizonDays} days apart — never a
          simulated or backtested price. A bucket only shows an average return once at least{" "}
          {minSampleSizeForAverage} snapshots have both a real entry and exit price; below that, sample counts
          are still shown honestly instead of hiding them. This is a small, ongoing dataset, not a
          statistically validated backtest — treat it as exploratory, not predictive.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {buckets.map((b) => (
          <Card key={b.label}>
            <CardHeader>
              <CardTitle className="text-base">Score {b.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Snapshots</span>
                <span className="tabular-nums">{b.sampleCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">With real price data</span>
                <span className="tabular-nums">{b.evaluableCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg {horizonDays}-day forward return</span>
                {b.averageForwardReturnPct !== null ? (
                  <Badge variant={pctVariant(b.averageForwardReturnPct)}>
                    {formatPct(b.averageForwardReturnPct)}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">Insufficient data</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Snapshot-by-snapshot detail ({rows.length})</h2>
        {rows.length === 0 ? (
          <EmptyState
            title="No evaluable snapshots yet"
            description={`Snapshots need to be at least ${horizonDays} days old before a forward return can be measured — check back after the feature has been in use for a couple of weeks.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Entry price</TableHead>
                  <TableHead>Exit price ({horizonDays}d)</TableHead>
                  <TableHead>Forward return</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.companyId}-${r.windowDays}-${r.snapshotDate}`}>
                    <TableCell className="text-sm">{r.snapshotDate}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/signal-convergence/companies/${r.ticker}`} className="hover:underline">
                        {r.ticker}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular-nums">{r.totalScore}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.windowDays}d</TableCell>
                    <TableCell className="tabular-nums">
                      {r.entryPrice !== null ? `$${r.entryPrice.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {r.exitPrice !== null ? `$${r.exitPrice.toFixed(2)}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={pctVariant(r.forwardReturnPct)}>{formatPct(r.forwardReturnPct)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
