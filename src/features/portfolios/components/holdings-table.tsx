import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HoldingSummary } from "@/features/portfolios/server/aggregate";
import {
  formatMoney,
  formatPercent,
  formatPlainPercent,
  gainLossClassName,
} from "@/features/portfolios/lib/format";

export function HoldingsTable({ rows }: { rows: HoldingSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Avg cost</TableHead>
          <TableHead className="text-right">Market value</TableHead>
          <TableHead className="text-right">Unrealized G/L</TableHead>
          <TableHead className="text-right">Allocation</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.companyId}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5">
                <Link href={`/companies/${row.ticker}`} className="hover:underline">
                  {row.ticker}
                </Link>
                {row.quoteUnavailable ? (
                  <Badge variant="outline" title="No live quote — showing cost basis instead">
                    unavailable
                  </Badge>
                ) : row.isStale ? (
                  <Badge variant="outline" title="Quote is more than 15 minutes old">
                    stale
                  </Badge>
                ) : null}
                {row.isOverConcentrationThreshold ? (
                  <Badge variant="destructive" title="Above the concentration warning threshold">
                    concentrated
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-64 truncate">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">{formatMoney(row.averageCost)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.quoteUnavailable ? (
                <span className="text-muted-foreground">{formatMoney(row.costBasis)} (cost basis)</span>
              ) : (
                formatMoney(row.marketValue)
              )}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${gainLossClassName(row.unrealizedGainLoss)}`}>
              {row.unrealizedGainLoss === null
                ? "—"
                : `${formatMoney(row.unrealizedGainLoss)} (${formatPercent(row.unrealizedGainLossPct)})`}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatPlainPercent(row.allocationPct)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
