import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { HoldingSummary } from "@/features/portfolios/server/aggregate";
import {
  formatMoney,
  formatPercent,
  gainLossArrow,
  gainLossClassName,
} from "@/features/portfolios/lib/format";

const LIMIT = 5;

function MoverList({
  title,
  icon: Icon,
  iconClassName,
  rows,
  emptyText,
}: {
  title: string;
  icon: typeof TrendingUp;
  iconClassName: string;
  rows: HoldingSummary[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={`size-4 ${iconClassName}`} aria-hidden="true" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">{emptyText}</p>
        ) : (
          <ul className="divide-y">
            {rows.map((holding) => (
              <li key={holding.companyId}>
                <Link
                  href={`/companies/${holding.ticker}`}
                  className="hover:bg-accent focus-visible:ring-ring -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 outline-none focus-visible:ring-2"
                >
                  <span className="font-medium">{holding.ticker}</span>
                  <span
                    className={`text-right text-sm tabular-nums ${gainLossClassName(holding.dailyGainLoss)}`}
                  >
                    {gainLossArrow(holding.dailyGainLoss)}
                    {formatPercent(holding.dailyGainLossPct)}
                    <span className="text-muted-foreground ml-2 text-xs">
                      {formatMoney(holding.dailyGainLoss)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Today's biggest movers by daily % change — holdings without a live quote are left out. */
export function TopMovers({ holdings }: { holdings: HoldingSummary[] }) {
  const withDaily = holdings.filter(
    (h) => h.dailyGainLossPct !== null && Number.isFinite(Number(h.dailyGainLossPct)),
  );
  if (withDaily.length === 0) return null;

  const gainers = withDaily
    .filter((h) => Number(h.dailyGainLossPct) > 0)
    .sort((a, b) => Number(b.dailyGainLossPct) - Number(a.dailyGainLossPct))
    .slice(0, LIMIT);
  const losers = withDaily
    .filter((h) => Number(h.dailyGainLossPct) < 0)
    .sort((a, b) => Number(a.dailyGainLossPct) - Number(b.dailyGainLossPct))
    .slice(0, LIMIT);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <MoverList
        title="Top gainers today"
        icon={TrendingUp}
        iconClassName="text-emerald-500"
        rows={gainers}
        emptyText="No holdings are up today."
      />
      <MoverList
        title="Top losers today"
        icon={TrendingDown}
        iconClassName="text-rose-500"
        rows={losers}
        emptyText="No holdings are down today."
      />
    </div>
  );
}
