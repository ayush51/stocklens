"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  computePortfolioScenario,
  type PositionScenarioInput,
} from "@/features/scenario-analysis/lib/position-scenario";

function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function PortfolioScenarioTool({ positions }: { positions: PositionScenarioInput[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(positions.map((p) => p.ticker)));
  const [shockPct, setShockPct] = useState(-20);

  const result = useMemo(
    () => computePortfolioScenario({ positions, shockedTickers: selected, shockPct }),
    [positions, selected, shockPct],
  );

  function toggle(ticker: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="shockPct">Shock (%)</Label>
          <Input
            id="shockPct"
            type="number"
            className="w-28"
            value={shockPct}
            onChange={(e) => setShockPct(Number(e.target.value))}
          />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(positions.map((p) => p.ticker)))}
          >
            All positions (broad-market shock)
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            Clear selection
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <p className="text-muted-foreground text-xs">Baseline value</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(result.baselineMarketValue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Scenario value</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(result.scenarioMarketValue)}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Portfolio impact</p>
          <p
            className={`text-lg font-semibold tabular-nums ${result.portfolioImpact < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {formatMoney(result.portfolioImpact)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground text-xs">Portfolio impact %</p>
          <p
            className={`text-lg font-semibold tabular-nums ${result.portfolioImpactPct < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
          >
            {formatPct(result.portfolioImpactPct)}
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shocked</TableHead>
            <TableHead>Ticker</TableHead>
            <TableHead className="text-right">Scenario price</TableHead>
            <TableHead className="text-right">Market value</TableHead>
            <TableHead className="text-right">Gain/loss</TableHead>
            <TableHead className="text-right">Allocation</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {result.positions.map((p) => (
            <TableRow key={p.ticker}>
              <TableCell>
                <input type="checkbox" checked={selected.has(p.ticker)} onChange={() => toggle(p.ticker)} />
              </TableCell>
              <TableCell className="font-medium">
                {p.ticker} {p.wasShocked ? <Badge variant="outline">shocked</Badge> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(p.scenarioPrice)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatMoney(p.positionMarketValue)}</TableCell>
              <TableCell
                className={`text-right tabular-nums ${p.gainLoss < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
              >
                {formatMoney(p.gainLoss)}
              </TableCell>
              <TableCell className="text-right tabular-nums">{p.allocationPct.toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
