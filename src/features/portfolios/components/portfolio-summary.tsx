import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PortfolioAggregate } from "@/features/portfolios/server/aggregate";
import { formatMoney, formatPercent, gainLossClassName } from "@/features/portfolios/lib/format";

// Accepts a single portfolio's summary (PortfolioSummary) or the
// cross-portfolio rollup (DashboardSummary) — both are structurally a
// superset of the aggregate fields this card actually renders.
type PortfolioSummaryCardData = Pick<
  PortfolioAggregate,
  | "investedCapital"
  | "estimatedMarketValue"
  | "isPartial"
  | "totalUnrealizedGainLoss"
  | "totalUnrealizedGainLossPct"
  | "totalDailyGainLoss"
  | "totalRealizedGainLoss"
  | "isRealizedGainLossPartial"
  | "concentrationWarnings"
>;

function Stat({
  label,
  value,
  valueClassName,
  badge,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  badge?: { text: string; title: string };
}) {
  return (
    <div>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        {label}
        {badge ? (
          <Badge variant="outline" title={badge.title} className="px-1 py-0 text-[10px]">
            {badge.text}
          </Badge>
        ) : null}
      </p>
      <p className={`text-lg font-semibold tabular-nums ${valueClassName ?? ""}`}>{value}</p>
    </div>
  );
}

export function PortfolioSummaryCard({ portfolio }: { portfolio: PortfolioSummaryCardData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Summary
          {portfolio.isPartial ? (
            <Badge
              variant="outline"
              title="Some holdings have no live quote — their cost basis is used instead"
            >
              estimated
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Invested capital" value={formatMoney(portfolio.investedCapital)} />
        <Stat
          label={portfolio.isPartial ? "Est. market value" : "Market value"}
          value={formatMoney(portfolio.estimatedMarketValue)}
        />
        <Stat
          label="Unrealized G/L"
          value={
            portfolio.totalUnrealizedGainLoss === null
              ? "—"
              : `${formatMoney(portfolio.totalUnrealizedGainLoss)} (${formatPercent(portfolio.totalUnrealizedGainLossPct)})`
          }
          valueClassName={gainLossClassName(portfolio.totalUnrealizedGainLoss)}
        />
        <Stat
          label="Today"
          value={formatMoney(portfolio.totalDailyGainLoss)}
          valueClassName={gainLossClassName(portfolio.totalDailyGainLoss)}
        />
        <Stat
          label="Realized G/L"
          value={formatMoney(portfolio.totalRealizedGainLoss)}
          valueClassName={gainLossClassName(portfolio.totalRealizedGainLoss)}
          badge={
            portfolio.isRealizedGainLossPartial
              ? {
                  text: "incomplete",
                  title:
                    "Some holdings have no transaction history recorded (e.g. positions synced directly from Robinhood, which reports current holdings but not the trade history behind them) — this figure only reflects what's actually tracked, not a confirmed $0 for those positions.",
                }
              : undefined
          }
        />
      </CardContent>
      {portfolio.concentrationWarnings.length > 0 ? (
        <CardContent className="border-t pt-4">
          <p className="text-muted-foreground mb-2 text-xs">Concentration warnings</p>
          <div className="flex flex-wrap gap-2">
            {portfolio.concentrationWarnings.map((holding) => (
              <Badge key={holding.companyId} variant="destructive">
                {holding.ticker} — {Number(holding.allocationPct).toFixed(1)}%
              </Badge>
            ))}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
