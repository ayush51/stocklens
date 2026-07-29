import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CompanyMetricTemplateSummary } from "@/features/company-metrics/server/queries";
import { RecordObservationDialog } from "@/features/company-metrics/components/record-observation-dialog";
import { formatMetricValue as formatValue } from "@/features/company-metrics/lib/format-value";

export function KpiList({ template, ticker }: { template: CompanyMetricTemplateSummary; ticker: string }) {
  return (
    <div className="space-y-4">
      {template.source === "AI_PROPOSED" ? (
        <div className="border-border bg-muted/50 rounded-lg border p-3 text-sm">
          <span className="font-medium">AI-proposed template.</span>{" "}
          <span className="text-muted-foreground">
            The metric list and &quot;why it matters&quot; notes are general knowledge of how this company
            reports, not verified against a specific filing. Treat as a starting point — confirm against the
            real 10-Q/10-K before relying on it, and every value below still requires a real, cited source.
          </span>
        </div>
      ) : null}
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
                  ) : item.latestObservation.confidence === "UNVERIFIED" ? (
                    <Badge
                      variant="outline"
                      title="AI-extracted from the source filing, not yet human-verified"
                    >
                      AI-extracted
                    </Badge>
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
                  <p className="text-muted-foreground text-xs">
                    Source:{" "}
                    {item.latestObservation.source.startsWith("http") ? (
                      <a
                        href={item.latestObservation.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {item.latestObservation.source}
                      </a>
                    ) : (
                      item.latestObservation.source
                    )}
                  </p>
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
