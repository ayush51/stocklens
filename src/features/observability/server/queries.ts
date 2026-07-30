import { prismaService } from "@/lib/db/prisma-service";

export interface ObservabilitySnapshot {
  aiSummaryCountsByType: { subjectType: string; model: string; count: number }[];
  totalCompanies: number;
  companiesWithFilings: number;
  companiesWithFinancialStatements: number;
  companiesWithKpiTemplate: number;
  metricObservationsByConfidence: { confidence: string; count: number }[];
  generatedAt: Date;
}

/**
 * Real numbers derived from data that's actually in the database — not a
 * fabricated dashboard. instructions.md §14 also asks for AI cost
 * estimates and cache hit rates; those still aren't included here because
 * nothing in this app tracks per-call token usage or cache state yet
 * (src/lib/logger.ts logs to stdout, which Vercel doesn't make queryable
 * without a log drain/APM service — see task #75). Provider latency and
 * failure rates ARE now tracked (ProviderCallLog, since 2026-07-30) — see
 * getProviderResilienceSnapshot below. Showing a made-up number for what's
 * genuinely not tracked would violate the same "never invent" rule this
 * whole app is built around, so those are left out rather than guessed.
 */
export async function getObservabilitySnapshot(): Promise<ObservabilitySnapshot> {
  const [
    aiSummaryGroups,
    totalCompanies,
    companiesWithFilingsGroups,
    companiesWithStatementsGroups,
    companiesWithKpiTemplate,
    observationGroups,
  ] = await Promise.all([
    prismaService.aISummary.groupBy({ by: ["subjectType", "model"], _count: true }),
    prismaService.company.count(),
    prismaService.secFiling.groupBy({ by: ["companyId"] }),
    prismaService.financialStatement.groupBy({ by: ["companyId"] }),
    prismaService.companyMetricTemplate.count(),
    prismaService.metricObservation.groupBy({ by: ["confidence"], _count: true }),
  ]);

  return {
    aiSummaryCountsByType: aiSummaryGroups.map((g) => ({
      subjectType: g.subjectType,
      model: g.model,
      count: g._count,
    })),
    totalCompanies,
    companiesWithFilings: companiesWithFilingsGroups.length,
    companiesWithFinancialStatements: companiesWithStatementsGroups.length,
    companiesWithKpiTemplate,
    metricObservationsByConfidence: observationGroups.map((g) => ({
      confidence: g.confidence,
      count: g._count,
    })),
    generatedAt: new Date(),
  };
}

export interface ProviderResilienceRow {
  provider: string;
  totalCalls: number;
  errorCount: number;
  errorRatePct: number;
  rateLimitedCount: number;
  fallbackCount: number;
  avgDurationMs: number;
  maxDurationMs: number;
}

const PROVIDER_RESILIENCE_WINDOW_DAYS = 7;

/**
 * instructions.md §13's per-call tracking, aggregated per provider over a
 * rolling window (rather than an unbounded all-time count, which would
 * dilute a recent regression under months of healthy history). Explicitly
 * NOT covered: "data disagreements" (there's only ever one active provider
 * per data type right now, so there's nothing to disagree with) and
 * "freshness" as a call attribute (already covered per-quote via
 * isQuoteStale, not a provider-call property).
 */
export async function getProviderResilienceSnapshot(): Promise<ProviderResilienceRow[]> {
  const since = new Date(Date.now() - PROVIDER_RESILIENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const logs = await prismaService.providerCallLog.findMany({
    where: { requestedAt: { gte: since } },
    select: { provider: true, status: true, rateLimited: true, usedFallback: true, durationMs: true },
  });

  const byProvider = new Map<string, typeof logs>();
  for (const log of logs) {
    const list = byProvider.get(log.provider) ?? [];
    list.push(log);
    byProvider.set(log.provider, list);
  }

  return [...byProvider.entries()]
    .map(([provider, rows]) => {
      const errorCount = rows.filter((r) => r.status === "ERROR").length;
      const durations = rows.map((r) => r.durationMs);
      return {
        provider,
        totalCalls: rows.length,
        errorCount,
        errorRatePct: rows.length > 0 ? (errorCount / rows.length) * 100 : 0,
        rateLimitedCount: rows.filter((r) => r.rateLimited).length,
        fallbackCount: rows.filter((r) => r.usedFallback).length,
        avgDurationMs:
          durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        maxDurationMs: durations.length > 0 ? Math.max(...durations) : 0,
      };
    })
    .sort((a, b) => b.totalCalls - a.totalCalls);
}
