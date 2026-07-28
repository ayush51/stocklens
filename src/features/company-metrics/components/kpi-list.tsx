import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyMetricTemplateSummary } from "@/features/company-metrics/server/queries";
import { RecordObservationDialog } from "@/features/company-metrics/components/record-observation-dialog";
import { formatMetricValue as formatValue } from "@/features/company-metrics/lib/format-value";

export function KpiList({ template, ticker }: { template: CompanyMetricTemplateSummary; ticker: string }) {
  return (
    <div className="space-y-4">
      {template.items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle>{item.label}</CardTitle>
                {item.whyItMatters ? (
                  <p className="text-muted-foreground mt-1 text-sm">{item.whyItMatters}</p>
                ) : null}
              </div>
              <RecordObservationDialog
                templateItemId={item.id}
                ticker={ticker}
                metricLabel={item.label}
                unit={item.unit}
              />
            </div>
          </CardHeader>
          <CardContent>
            {item.latestObservation ? (
              <div className="space-y-3">
                <div className="flex items-baseline gap-3">
                  <span className="text-2xl font-semibold tabular-nums">
                    {formatValue(item.latestObservation.value, item.latestObservation.unit)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {item.latestObservation.fiscalPeriod} {item.latestObservation.fiscalYear}
                  </span>
                  {item.latestObservation.isManualOverride ? (
                    <Badge variant="outline">manually recorded</Badge>
                  ) : null}
                </div>
                {item.history.length > 1 ? (
                  <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                    {item.history.slice(1).map((obs) => (
                      <span key={`${obs.fiscalYear}-${obs.fiscalPeriod}`}>
                        {obs.fiscalPeriod} {obs.fiscalYear}: {formatValue(obs.value, obs.unit)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {item.latestObservation.source ? (
                  <p className="text-muted-foreground text-xs">Source: {item.latestObservation.source}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                Not recorded yet
                {item.reportedIn ? ` — typically reported in ${item.reportedIn}.` : "."}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
