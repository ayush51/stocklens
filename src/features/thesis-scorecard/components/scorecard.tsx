import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/shared/components/empty-state";
import type { ScorecardSummary } from "@/features/thesis-scorecard/server/queries";
import {
  statusBadgeClassName,
  trendBadgeClassName,
  trendLabel,
} from "@/features/thesis-scorecard/lib/status-style";
import { AddCriterionDialog } from "@/features/thesis-scorecard/components/add-criterion-dialog";
import { RecordEvaluationDialog } from "@/features/thesis-scorecard/components/record-evaluation-dialog";

export function Scorecard({
  thesisId,
  ticker,
  scorecard,
}: {
  thesisId: string;
  ticker: string;
  scorecard: ScorecardSummary;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CardTitle>Scorecard</CardTitle>
            <Badge className={trendBadgeClassName(scorecard.trend)} variant="secondary">
              {trendLabel(scorecard.trend)}
            </Badge>
          </div>
          <AddCriterionDialog thesisId={thesisId} ticker={ticker} />
        </div>
      </CardHeader>
      <CardContent>
        {scorecard.criteria.length === 0 ? (
          <EmptyState
            title="No criteria yet"
            description="Define what would strengthen or invalidate this thesis — numeric thresholds, growth rates, or qualitative reviews."
          />
        ) : (
          <div className="space-y-3">
            {scorecard.criteria.map((criterion) => (
              <div key={criterion.id} className="border-border rounded-lg border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{criterion.metricLabel}</p>
                      <Badge
                        className={statusBadgeClassName(
                          criterion.latestEvaluation?.status ?? "INSUFFICIENT_DATA",
                        )}
                      >
                        {criterion.latestEvaluation?.status ?? "INSUFFICIENT_DATA"}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {criterion.evaluationPeriod} · Green: {criterion.greenRule} · Watch:{" "}
                      {criterion.watchRule} · Red: {criterion.redRule}
                    </p>
                    {criterion.latestEvaluation ? (
                      <p className="mt-2 text-sm">
                        {criterion.latestEvaluation.fiscalPeriod} {criterion.latestEvaluation.fiscalYear}:{" "}
                        {criterion.latestEvaluation.currentValue ?? "—"}
                        {criterion.latestEvaluation.explanation
                          ? ` — ${criterion.latestEvaluation.explanation}`
                          : ""}
                      </p>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">Not evaluated yet</p>
                    )}
                  </div>
                  <RecordEvaluationDialog criterion={criterion} ticker={ticker} />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
