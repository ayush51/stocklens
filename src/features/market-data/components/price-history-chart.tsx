"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { PriceBar, Quote } from "@/shared/contracts/market-data-provider";

const chartConfig: ChartConfig = {
  close: { label: "Close", color: "var(--chart-1)" },
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const currencyFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function PriceHistoryChart({ quote, bars }: { quote: Quote | null; bars: PriceBar[] }) {
  if (bars.length === 0 && !quote) return null;

  const data = bars.map((bar) => ({ date: bar.date, close: Number(bar.close) }));

  const latestClose = quote ? Number(quote.price) : data.length > 0 ? data[data.length - 1].close : null;
  const previousClose = quote?.previousClose ? Number(quote.previousClose) : null;
  const change = latestClose != null && previousClose != null ? latestClose - previousClose : null;
  const changePct = change != null && previousClose ? (change / previousClose) * 100 : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Price history</CardTitle>
          {quote ? (
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold">{currencyFormatter.format(Number(quote.price))}</span>
              {change != null && changePct != null ? (
                <Badge variant={change >= 0 ? "default" : "destructive"} className="text-xs">
                  {change >= 0 ? "+" : ""}
                  {change.toFixed(2)} ({changePct >= 0 ? "+" : ""}
                  {changePct.toFixed(2)}%)
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          {quote ? `As of ${new Date(quote.marketTimestamp).toLocaleString()} · ${quote.source}` : null}
          {bars.length > 0 ? ` · ${bars.length} trading days shown` : null}
        </p>
      </CardHeader>
      <CardContent>
        {data.length > 1 ? (
          <ChartContainer config={chartConfig} className="h-[220px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                tickFormatter={(value: string) => dateFormatter.format(new Date(value))}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                width={56}
                domain={["auto", "auto"]}
                tickFormatter={(value: number) => currencyFormatter.format(value)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => dateFormatter.format(new Date(value as string))}
                    formatter={(value) => currencyFormatter.format(Number(value))}
                  />
                }
              />
              <Area
                dataKey="close"
                type="monotone"
                fill="url(#priceFill)"
                stroke="var(--chart-1)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <p className="text-muted-foreground text-sm">Not enough historical price data to chart yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
