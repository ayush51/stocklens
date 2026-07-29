import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { UpcomingEarningsRow } from "@/features/earnings/server/queries";

const TIMING_LABEL: Record<string, string> = {
  BEFORE_MARKET: "Before market open",
  AFTER_MARKET: "After market close",
  DURING_MARKET: "During market hours",
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T00:00:00");
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
  return Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
}

export function EarningsCalendarList({ rows }: { rows: UpcomingEarningsRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const days = daysUntil(row.reportDate);
        return (
          <Card key={`${row.companyId}-${row.fiscalYear}-${row.fiscalPeriod}`}>
            <CardContent className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-medium">
                    {dateFormatter.format(new Date(row.reportDate + "T00:00:00"))}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`}
                  </p>
                </div>
                <Link href={`/companies/${row.ticker}`} className="font-medium hover:underline">
                  {row.ticker}
                </Link>
                <span className="text-muted-foreground text-sm">{row.name}</span>
                <Badge variant="outline">
                  {row.fiscalPeriod} {row.fiscalYear}
                </Badge>
                {row.timing ? (
                  <span className="text-muted-foreground text-xs">
                    {TIMING_LABEL[row.timing] ?? row.timing}
                  </span>
                ) : null}
              </div>
              <div className="text-muted-foreground shrink-0 text-right text-xs">
                {row.epsEstimate ? <p>EPS est. ${Number(row.epsEstimate).toFixed(2)}</p> : null}
                {row.revenueEstimate ? (
                  <p>Rev. est. {compactCurrency.format(Number(row.revenueEstimate))}</p>
                ) : null}
                {!row.epsEstimate && !row.revenueEstimate ? <p>No consensus estimate available</p> : null}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
