"use client";

import { Cell, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { HoldingSummary } from "@/features/portfolios/server/aggregate";

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const OTHER_COLOR = "var(--muted-foreground)";
const MAX_SLICES = 8;

export function AllocationChart({ holdings }: { holdings: HoldingSummary[] }) {
  const sorted = [...holdings]
    .filter((h) => Number(h.allocationPct) > 0)
    .sort((a, b) => Number(b.allocationPct) - Number(a.allocationPct));

  if (sorted.length === 0) return null;

  const top = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES);
  const otherPct = rest.reduce((sum, h) => sum + Number(h.allocationPct), 0);

  const data = [
    ...top.map((h) => ({ name: h.ticker, value: Number(h.allocationPct) })),
    ...(otherPct > 0 ? [{ name: `Other (${rest.length})`, value: otherPct }] : []),
  ];

  const chartConfig: ChartConfig = Object.fromEntries(data.map((d) => [d.name, { label: d.name }]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
        <p className="text-muted-foreground text-xs">
          Share of portfolio value by holding — market value where known, cost basis as a fallback.
        </p>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <ChartContainer config={chartConfig} className="aspect-square h-[220px] w-[220px] shrink-0">
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)}%`} />}
            />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} strokeWidth={2}>
              {data.map((entry, i) => (
                <Cell
                  key={entry.name}
                  fill={entry.name.startsWith("Other") ? OTHER_COLOR : COLORS[i % COLORS.length]}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {data.map((entry, i) => (
            <div key={entry.name} className="flex items-center gap-1.5 truncate">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor: entry.name.startsWith("Other") ? OTHER_COLOR : COLORS[i % COLORS.length],
                }}
              />
              <span className="truncate">{entry.name}</span>
              <span className="text-muted-foreground ml-auto tabular-nums">{entry.value.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
