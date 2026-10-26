import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import {
  getObservabilitySnapshot,
  getProviderResilienceSnapshot,
} from "@/features/observability/server/queries";
import { PageHeader } from "@/shared/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Observability" };

export default async function ObservabilityPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [snapshot, providerRows] = await Promise.all([
    getObservabilitySnapshot(),
    getProviderResilienceSnapshot(),
  ]);
  const totalAiCalls = snapshot.aiSummaryCountsByType.reduce((sum, g) => sum + g.count, 0);
  const totalObservations = snapshot.metricObservationsByConfidence.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Observability"
        description={`Real counts derived from the database, as of ${snapshot.generatedAt.toLocaleString()}.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>AI usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-2xl font-semibold tabular-nums">{totalAiCalls}</p>
          <p className="text-muted-foreground text-xs">
            cached AI-generated summaries stored, by type and model
          </p>
          <div className="space-y-1 pt-2">
            {snapshot.aiSummaryCountsByType.map((g) => (
              <div key={`${g.subjectType}-${g.model}`} className="flex items-center justify-between text-sm">
                <span>
                  {g.subjectType} <span className="text-muted-foreground">({g.model})</span>
                </span>
                <span className="tabular-nums">{g.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span>Companies with filings on file</span>
            <span className="tabular-nums">
              {snapshot.companiesWithFilings} / {snapshot.totalCompanies}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Companies with financial statements</span>
            <span className="tabular-nums">
              {snapshot.companiesWithFinancialStatements} / {snapshot.totalCompanies}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Companies with a KPI template</span>
            <span className="tabular-nums">
              {snapshot.companiesWithKpiTemplate} / {snapshot.totalCompanies}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>KPI observation confidence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-muted-foreground text-xs">
            {totalObservations} recorded metric values, by confidence
          </p>
          {snapshot.metricObservationsByConfidence.map((g) => (
            <div key={g.confidence} className="flex items-center justify-between text-sm">
              <Badge variant="outline">{g.confidence}</Badge>
              <span className="tabular-nums">{g.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provider resilience (last 7 days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {providerRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No provider calls logged in the last 7 days.</p>
          ) : (
            providerRows.map((row) => (
              <div key={row.provider} className="space-y-1 border-b pb-2 text-sm last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{row.provider}</span>
                  <span className="tabular-nums">{row.totalCalls} calls</span>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  <span>
                    {row.errorCount} errors ({row.errorRatePct.toFixed(1)}%)
                  </span>
                  <span>{row.rateLimitedCount} rate-limited</span>
                  {row.fallbackCount > 0 ? <span>{row.fallbackCount} via fallback</span> : null}
                  <span>
                    {row.avgDurationMs}ms avg / {row.maxDurationMs}ms max
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Not tracked yet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            AI cost per call and cache hit rates aren&apos;t shown here — nothing in this app tracks per-call
            token usage or cache state yet. Cross-provider data disagreements aren&apos;t tracked either,
            since there&apos;s only ever one active provider per data type right now — nothing to disagree
            with. Showing a number for these without real tracking behind it would be a guess, so they&apos;re
            left out rather than fabricated.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
