import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyAnalysisSnapshot } from "@/features/company-analysis/server/queries";

const GROWTH_LABEL: Record<string, { text: string; variant: "default" | "outline" | "destructive" }> = {
  ACCELERATING: { text: "Growth accelerating", variant: "default" },
  STABLE: { text: "Growth stable", variant: "outline" },
  DECELERATING: { text: "Growth decelerating", variant: "destructive" },
  INSUFFICIENT_DATA: { text: "Not enough data yet", variant: "outline" },
};

const MARGIN_LABEL: Record<string, { text: string; variant: "default" | "outline" | "destructive" }> = {
  IMPROVING: { text: "Margins improving", variant: "default" },
  STABLE: { text: "Margins stable", variant: "outline" },
  DECLINING: { text: "Margins declining", variant: "destructive" },
  INSUFFICIENT_DATA: { text: "Not enough data yet", variant: "outline" },
};

const VALUATION_LABEL: Record<string, { text: string; variant: "default" | "outline" | "destructive" }> = {
  BELOW_RANGE: { text: "Below its 52-week range", variant: "outline" },
  LOWER_HALF: { text: "Lower half of 52-week range", variant: "outline" },
  UPPER_HALF: { text: "Upper half of 52-week range", variant: "default" },
  ABOVE_RANGE: { text: "Above its 52-week range", variant: "destructive" },
  INSUFFICIENT_DATA: { text: "Not enough data yet", variant: "outline" },
};

function StateRow({
  label,
  formula,
  comparisonPeriods,
  confidence,
  sourceTimestamp,
}: {
  label: { text: string; variant: "default" | "outline" | "destructive" };
  formula: string;
  comparisonPeriods: string | null;
  confidence: string;
  sourceTimestamp: Date | null;
}) {
  return (
    <div className="space-y-1 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Badge variant={label.variant}>{label.text}</Badge>
        <Badge variant="outline" className="text-[10px]">
          {confidence}
        </Badge>
      </div>
      <p className="text-muted-foreground text-xs">{formula}</p>
      {comparisonPeriods ? <p className="text-xs">{comparisonPeriods}</p> : null}
      {sourceTimestamp ? (
        <p className="text-muted-foreground text-[11px]">
          As of data fetched {new Date(sourceTimestamp).toLocaleDateString()}
        </p>
      ) : null}
    </div>
  );
}

export function ChangeDetectionPanel({ snapshot }: { snapshot: CompanyAnalysisSnapshot }) {
  const { growthTrend, marginTrend, valuationPosition } = snapshot;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What&apos;s changing</CardTitle>
        <p className="text-muted-foreground text-xs">
          Deterministic calculations from real reported/live data — not AI-generated. Each state shows exactly
          how it was computed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <StateRow
          label={GROWTH_LABEL[growthTrend.state]}
          formula={growthTrend.formula}
          comparisonPeriods={growthTrend.comparisonPeriods}
          confidence={growthTrend.confidence}
          sourceTimestamp={growthTrend.sourceTimestamp}
        />
        <StateRow
          label={MARGIN_LABEL[marginTrend.state]}
          formula={marginTrend.formula}
          comparisonPeriods={marginTrend.comparisonPeriods}
          confidence={marginTrend.confidence}
          sourceTimestamp={marginTrend.sourceTimestamp}
        />
        {valuationPosition ? (
          <StateRow
            label={VALUATION_LABEL[valuationPosition.state]}
            formula={valuationPosition.formula}
            comparisonPeriods={valuationPosition.comparisonPeriods}
            confidence={valuationPosition.confidence}
            sourceTimestamp={valuationPosition.sourceTimestamp}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
