import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PastEarningsRow } from "@/features/earnings/server/queries";
import type { EarningsSurprise } from "@/features/earnings/lib/surprise";
import { EarningsReviewDialog } from "@/features/earnings/components/earnings-review-dialog";

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const SURPRISE_BADGE: Record<
  EarningsSurprise["classification"],
  { label: string; variant: "default" | "destructive" | "secondary" | "outline" }
> = {
  BEAT: { label: "Beat", variant: "default" },
  MISS: { label: "Miss", variant: "destructive" },
  INLINE: { label: "In line", variant: "secondary" },
  NO_ESTIMATE: { label: "No estimate", variant: "outline" },
  NOT_YET_REPORTED: { label: "Not filed yet", variant: "outline" },
};

function SurpriseCell({
  label,
  estimate,
  actual,
  surprise,
  formatValue,
}: {
  label: string;
  estimate: string | null;
  actual: string | null;
  surprise: EarningsSurprise;
  formatValue: (v: string) => string;
}) {
  const badge = SURPRISE_BADGE[surprise.classification];
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="text-sm tabular-nums">
          {actual !== null ? formatValue(actual) : "—"}
          {estimate !== null ? (
            <span className="text-muted-foreground"> / est. {formatValue(estimate)}</span>
          ) : null}
        </p>
        <Badge variant={badge.variant} className="text-[10px]">
          {badge.label}
          {surprise.surprisePct !== null
            ? ` ${surprise.surprisePct > 0 ? "+" : ""}${surprise.surprisePct.toFixed(1)}%`
            : ""}
        </Badge>
      </div>
    </div>
  );
}

export function PastEarningsList({ rows }: { rows: PastEarningsRow[] }) {
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <Card key={row.earningsEventId}>
          <CardContent className="space-y-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <p className="w-28 shrink-0 text-sm font-medium">
                  {dateFormatter.format(new Date(row.reportDate + "T00:00:00"))}
                </p>
                <Link href={`/companies/${row.ticker}`} className="font-medium hover:underline">
                  {row.ticker}
                </Link>
                <span className="text-muted-foreground text-sm">{row.name}</span>
                <Badge variant="outline">
                  {row.fiscalPeriod} {row.fiscalYear}
                </Badge>
              </div>
              <EarningsReviewDialog
                earningsEventId={row.earningsEventId}
                companyId={row.companyId}
                ticker={row.ticker}
                label={row.review ? "Edit review" : "Add review"}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
              <SurpriseCell
                label="EPS"
                estimate={row.epsEstimate}
                actual={row.epsActual}
                surprise={row.epsSurprise}
                formatValue={(v) => `$${Number(v).toFixed(2)}`}
              />
              <SurpriseCell
                label="Revenue"
                estimate={row.revenueEstimate}
                actual={row.revenueActual}
                surprise={row.revenueSurprise}
                formatValue={(v) => compactCurrency.format(Number(v))}
              />
            </div>
            {row.review ? (
              <div className="border-t pt-2 text-sm">
                <p className="text-muted-foreground text-xs">
                  Your review{row.review.affectsThesis ? " — flagged as thesis-relevant" : ""}
                </p>
                <p className="whitespace-pre-wrap">{row.review.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
