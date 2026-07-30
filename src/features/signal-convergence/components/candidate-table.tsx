"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SignalCandidate, CandidatePriceInfo } from "@/features/signal-convergence/server/queries";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const PAGE_SIZE = 20;

function scoreVariant(score: number): "default" | "secondary" | "outline" {
  if (score >= 60) return "default";
  if (score >= 30) return "secondary";
  return "outline";
}

export function CandidateTable({
  candidates,
  prices,
}: {
  candidates: SignalCandidate[];
  prices: Map<string, CandidatePriceInfo>;
}) {
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const minScoreNum = minScore ? Number(minScore) : 0;
    const minConfidenceNum = minConfidence ? Number(minConfidence) / 100 : 0;

    return candidates.filter((c) => {
      if (
        searchLower &&
        !c.ticker.toLowerCase().includes(searchLower) &&
        !c.name.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
      if (c.totalScore < minScoreNum) return false;
      if (c.confidence < minConfidenceNum) return false;
      return true;
    });
  }, [candidates, search, minScore, minConfidence]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Search ticker or company</label>
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="e.g. NVDA"
            className="w-48"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Minimum score</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => {
              setMinScore(e.target.value);
              setPage(1);
            }}
            className="w-28"
          />
        </div>
        <div className="space-y-1">
          <label className="text-muted-foreground text-xs">Minimum confidence (%)</label>
          <Input
            type="number"
            min={0}
            max={100}
            value={minConfidence}
            onChange={(e) => {
              setMinConfidence(e.target.value);
              setPage(1);
            }}
            className="w-32"
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {filtered.length} of {candidates.length} candidates
        </p>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ticker</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Evidence Score</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Signals</TableHead>
              <TableHead>Most recent event</TableHead>
              <TableHead>Insider</TableHead>
              <TableHead>Contracts</TableHead>
              <TableHead>Congress</TableHead>
              <TableHead>Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((c) => {
              const priceInfo = prices.get(c.ticker);
              return (
                <TableRow key={c.companyId}>
                  <TableCell className="font-medium">
                    <Link href={`/signal-convergence/companies/${c.ticker}`} className="hover:underline">
                      {c.ticker}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-40 truncate">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={scoreVariant(c.totalScore)}>{c.totalScore}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{Math.round(c.confidence * 100)}%</TableCell>
                  <TableCell>
                    <Badge variant="outline">{c.categoriesMatched}/3</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.mostRecentEventDate ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.insiderEventCount > 0 ? `${c.insiderEventCount} events` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.contractEventCount > 0 ? `${c.contractEventCount} events` : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.congressEventCount > 0 ? `${c.congressEventCount} events` : "—"}
                  </TableCell>
                  <TableCell className="text-sm tabular-nums">
                    {priceInfo?.price ? (
                      <span title={priceInfo.isDelayed ? "Delayed price" : undefined}>
                        {compactCurrency.format(Number(priceInfo.price))}
                        {priceInfo.isDelayed ? (
                          <span className="text-muted-foreground"> (delayed)</span>
                        ) : null}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {pageRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-muted-foreground py-6 text-center text-sm">
                  No candidates match these filters.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-primary disabled:text-muted-foreground disabled:no-underline hover:underline"
          >
            Previous
          </button>
          <p className="text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-primary disabled:text-muted-foreground disabled:no-underline hover:underline"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
