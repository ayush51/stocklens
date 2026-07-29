"use client";

import { Bar, CartesianGrid, ComposedChart, Legend, Line, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

interface StatementRow {
  fiscalYear: number;
  fiscalPeriod: string;
  revenue: unknown;
  netIncome: unknown;
  eps: unknown;
}

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
  netIncome: { label: "Net income", color: "var(--chart-2)" },
  eps: { label: "EPS (diluted)", color: "var(--chart-3)" },
};

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const preciseCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

/** Statements arrive most-recent-first (see queries.ts ordering) — charts read left-to-right oldest-to-newest. */
export function FinancialsTrendChart({ statements }: { statements: StatementRow[] }) {
  const data = [...statements]
    .reverse()
    .map((s) => ({
      period: s.fiscalPeriod === "FY" ? `FY${s.fiscalYear}` : `${s.fiscalPeriod} ${s.fiscalYear}`,
      revenue: toNumber(s.revenue),
      netIncome: toNumber(s.netIncome),
      eps: toNumber(s.eps),
    }))
    .filter((row) => row.revenue !== null || row.netIncome !== null);

  if (data.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue, net income &amp; EPS trend</CardTitle>
        <p className="text-muted-foreground text-xs">
          From SEC EDGAR XBRL data — the same figures in the table below, charted over time.
        </p>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <ComposedChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="period" tickLine={false} axisLine={false} tickMargin={8} />
            <YAxis
              yAxisId="money"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(value: number) => compactCurrency.format(value)}
            />
            <YAxis
              yAxisId="eps"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={56}
              tickFormatter={(value: number) => preciseCurrency.format(value)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name) =>
                    name === "eps"
                      ? preciseCurrency.format(Number(value))
                      : compactCurrency.format(Number(value))
                  }
                />
              }
            />
            <Legend />
            <Bar yAxisId="money" dataKey="revenue" fill="var(--chart-1)" radius={4} />
            <Bar yAxisId="money" dataKey="netIncome" fill="var(--chart-2)" radius={4} />
            <Line yAxisId="eps" dataKey="eps" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
