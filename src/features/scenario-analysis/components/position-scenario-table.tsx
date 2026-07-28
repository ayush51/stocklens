"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  STANDARD_SHOCK_PERCENTAGES,
  computePositionScenarioAtShock,
  type PositionScenarioInput,
} from "@/features/scenario-analysis/lib/position-scenario";

function formatMoney(value: number): string {
  const sign = value < 0 ? "-" : "";
  return `${sign}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PositionScenarioTable({ positions }: { positions: PositionScenarioInput[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticker</TableHead>
            {STANDARD_SHOCK_PERCENTAGES.map((pct) => (
              <TableHead key={pct} className="text-right whitespace-nowrap">
                {pct === 0 ? "Current" : `${pct > 0 ? "+" : ""}${pct}%`}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {positions.map((position) => (
            <TableRow key={position.ticker}>
              <TableCell className="font-medium">{position.ticker}</TableCell>
              {STANDARD_SHOCK_PERCENTAGES.map((pct) => {
                const result = computePositionScenarioAtShock(position, pct);
                return (
                  <TableCell key={pct} className="text-right text-xs tabular-nums">
                    <div>{formatMoney(result.positionMarketValue)}</div>
                    <div
                      className={
                        result.gainLoss >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }
                    >
                      {formatMoney(result.gainLoss)}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
