import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnalystRecommendation } from "@/shared/contracts/market-data-provider";

const SEGMENTS: {
  key: keyof Omit<AnalystRecommendation, "ticker" | "period">;
  label: string;
  className: string;
}[] = [
  { key: "strongBuy", label: "Strong buy", className: "bg-emerald-600" },
  { key: "buy", label: "Buy", className: "bg-emerald-400" },
  { key: "hold", label: "Hold", className: "bg-muted-foreground/40" },
  { key: "sell", label: "Sell", className: "bg-red-400" },
  { key: "strongSell", label: "Strong sell", className: "bg-red-600" },
];

export function AnalystRecommendationWidget({
  recommendations,
}: {
  recommendations: AnalystRecommendation[];
}) {
  const latest = recommendations[0];
  if (!latest) return null;

  const total = SEGMENTS.reduce((sum, s) => sum + latest[s.key], 0);
  if (total === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analyst recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-xs">
          {total} analysts, as of {latest.period} — real counts, not an AI-derived opinion
        </p>
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {SEGMENTS.map((segment) => {
            const count = latest[segment.key];
            if (count === 0) return null;
            return (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(count / total) * 100}%` }}
                title={`${segment.label}: ${count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {SEGMENTS.map((segment) => (
            <span key={segment.key} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${segment.className}`} />
              {segment.label}: {latest[segment.key]}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
