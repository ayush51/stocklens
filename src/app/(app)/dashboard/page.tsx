import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSummary } from "@/features/portfolios/server/queries";
import { PortfolioSummaryCard } from "@/features/portfolios/components/portfolio-summary";
import { AllocationChart } from "@/features/portfolios/components/allocation-chart";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, gainLossClassName, formatPercent } from "@/features/portfolios/lib/format";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const summary = await getDashboardSummary(user.id);

  if (summary.holdings.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Dashboard"
          description="A cross-portfolio summary of everything you hold, across every portfolio."
        />
        <EmptyState
          title="No holdings yet"
          description="Add a portfolio and enter transactions, or sync Robinhood positions, from Portfolios."
          action={
            <Link href="/portfolios" className="text-sm underline">
              Go to Portfolios
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Cross-portfolio summary across ${summary.portfolioCount} portfolio${summary.portfolioCount === 1 ? "" : "s"}.`}
      />
      <PortfolioSummaryCard portfolio={summary} />
      <AllocationChart holdings={summary.holdings} />
      {summary.largestPositions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Largest positions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {summary.largestPositions.map((holding) => (
              <Link
                key={holding.companyId}
                href={`/companies/${holding.ticker}`}
                className="hover:bg-accent rounded-md border p-3 transition-colors"
              >
                <p className="font-medium">{holding.ticker}</p>
                <p className="text-muted-foreground text-xs">{Number(holding.allocationPct).toFixed(1)}%</p>
                <p className="text-sm tabular-nums">
                  {formatMoney(holding.marketValue ?? holding.costBasis)}
                </p>
                {holding.unrealizedGainLossPct !== null ? (
                  <p className={`text-xs tabular-nums ${gainLossClassName(holding.unrealizedGainLoss)}`}>
                    {formatPercent(holding.unrealizedGainLossPct)}
                  </p>
                ) : null}
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
