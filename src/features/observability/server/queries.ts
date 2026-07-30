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
 * fabricated dashboard. instructions.md §14 also asks for provider
 * latency/failure rates, AI cost estimates, and cache hit rates; those
 * aren't included here because nothing in this app persists per-call
 * outcomes yet (src/lib/logger.ts logs to stdout, which Vercel doesn't
 * make queryable without a log drain/APM service — see task #75). Showing
 * a made-up number for those would violate the same "never invent" rule
 * this whole app is built around, so they're left out rather than guessed.
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
