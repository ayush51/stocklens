"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HoldingSummary } from "@/features/portfolios/server/aggregate";
import {
  formatMoney,
  formatPercent,
  formatPlainPercent,
  gainLossArrow,
} from "@/features/portfolios/lib/format";

type SortKey =
  | "ticker"
  | "price"
  | "dailyGainLossPct"
  | "quantity"
  | "averageCost"
  | "marketValue"
  | "unrealizedGainLossPct"
  | "allocationPct";

type TagFilter = "stale" | "unavailable" | "concentrated";

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "averageCost", label: "Avg cost", align: "right" },
  { key: "price", label: "Price", align: "right" },
  { key: "dailyGainLossPct", label: "Day", align: "right" },
  { key: "quantity", label: "Quantity", align: "right" },
  { key: "marketValue", label: "Market value", align: "right" },
  { key: "unrealizedGainLossPct", label: "Unrealized G/L", align: "right" },
  { key: "allocationPct", label: "Allocation", align: "right" },
];

function numeric(value: string | null): number {
  if (value === null) return Number.NEGATIVE_INFINITY;
  const n = Number(value);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function gainPillClassName(value: string | null): string {
  if (value === null) return "bg-muted text-muted-foreground";
  const num = Number(value);
  if (num > 0) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
  if (num < 0) return "bg-rose-500/15 text-rose-700 dark:text-rose-300";
  return "bg-muted text-muted-foreground";
}

function GainPill({ value, children }: { value: string | null; children: React.ReactNode }) {
  return (
    <span
      className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ${gainPillClassName(value)}`}
    >
      <span aria-hidden="true">{gainLossArrow(value)}</span>
      {children}
    </span>
  );
}

function tagsFor(row: HoldingSummary): TagFilter[] {
  const tags: TagFilter[] = [];
  if (row.quoteUnavailable) tags.push("unavailable");
  else if (row.isStale) tags.push("stale");
  if (row.isOverConcentrationThreshold) tags.push("concentrated");
  return tags;
}

export function HoldingsTable({ rows }: { rows: HoldingSummary[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("allocationPct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<TagFilter>>(new Set());

  const availableFilters = useMemo(() => {
    const present = new Set<TagFilter>();
    for (const row of rows) {
      for (const tag of tagsFor(row)) present.add(tag);
    }
    return present;
  }, [rows]);

  function toggleFilter(tag: TagFilter) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q ? rows.filter((row) => row.ticker.toLowerCase().includes(q)) : rows;
    const filtered =
      activeFilters.size === 0
        ? searched
        : searched.filter((row) => tagsFor(row).some((tag) => activeFilters.has(tag)));

    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "ticker") return a.ticker.localeCompare(b.ticker) * dir;
      return (numeric(a[sortKey]) - numeric(b[sortKey])) * dir;
    });
    return sorted;
  }, [rows, query, activeFilters, sortKey, sortDir]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticker…"
          aria-label="Search holdings by ticker"
          className="h-8 w-44"
        />
        <span className="text-muted-foreground text-xs">
          {visibleRows.length} of {rows.length}
        </span>
      </div>
      {availableFilters.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs">Filter:</span>
          {(["unavailable", "stale", "concentrated"] as const)
            .filter((tag) => availableFilters.has(tag))
            .map((tag) => (
              <button key={tag} type="button" onClick={() => toggleFilter(tag)}>
                <Badge
                  variant={activeFilters.has(tag) ? "default" : "outline"}
                  className="cursor-pointer select-none"
                >
                  {tag}
                </Badge>
              </button>
            ))}
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead key={col.key} className={col.align === "right" ? "text-right" : undefined}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className={`hover:text-foreground inline-flex items-center gap-1 ${col.align === "right" ? "flex-row-reverse" : ""}`}
                >
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === "asc" ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="text-muted-foreground/50 size-3" />
                  )}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visibleRows.map((row) => (
            <TableRow key={row.companyId} className="hover:bg-muted/60">
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
              <TableCell className="text-right font-medium tabular-nums">
                {formatMoney(row.averageCost)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {row.price === null ? "—" : formatMoney(row.price)}
              </TableCell>
              <TableCell className="text-right">
                <GainPill value={row.dailyGainLossPct}>
                  {row.dailyGainLossPct === null ? "—" : formatPercent(row.dailyGainLossPct)}
                </GainPill>
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.quoteUnavailable ? (
                  <span className="text-muted-foreground">{formatMoney(row.costBasis)} (cost basis)</span>
                ) : (
                  formatMoney(row.marketValue)
                )}
              </TableCell>
              <TableCell className="text-right">
                <GainPill value={row.unrealizedGainLoss}>
                  {row.unrealizedGainLoss === null
                    ? "—"
                    : `${formatMoney(row.unrealizedGainLoss)} (${formatPercent(row.unrealizedGainLossPct)})`}
                </GainPill>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div className="flex items-center justify-end gap-2">
                  <div className="bg-muted h-1.5 w-16 overflow-hidden rounded-full">
                    <div
                      className="bg-chart-1 h-full rounded-full"
                      style={{ width: `${Math.min(100, Math.max(0, Number(row.allocationPct) * 4))}%` }}
                    />
                  </div>
                  {formatPlainPercent(row.allocationPct)}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
