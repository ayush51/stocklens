import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { computeEvidenceScore, type ScoreResult } from "@/features/signal-convergence/lib/scoring";

export type SignalWindow = 7 | 30 | 90;

export interface SignalCandidate extends ScoreResult {
  companyId: string;
  ticker: string;
  name: string;
  sector: string | null;
  mostRecentEventDate: string | null;
  insiderEventCount: number;
  contractEventCount: number;
  congressEventCount: number;
}

export interface VennOverlapCounts {
  insiderOnly: number;
  contractsOnly: number;
  congressOnly: number;
  insiderAndContracts: number;
  insiderAndCongress: number;
  contractsAndCongress: number;
  allThree: number;
  none: number;
}

function windowStart(window: SignalWindow, now: Date): Date {
  return new Date(now.getTime() - window * 24 * 60 * 60 * 1000);
}

/**
 * Computes scores fresh on every call rather than reading a cached
 * SignalSnapshot — this app's whole data volume (dozens of companies, a
 * few hundred events) is small enough that this is fast, and it avoids a
 * whole class of staleness bugs a cache would introduce. Each call also
 * writes a SignalSnapshot row as a side effect (best-effort — a write
 * failure here must never break the page), which is what gives Phase 3's
 * historical-performance view real data to work with over time, without
 * a separate dedicated recomputation job.
 */
export async function getSignalCandidates(
  window: SignalWindow,
  now: Date = new Date(),
): Promise<SignalCandidate[]> {
  const since = windowStart(window, now);

  const [companies, insiderEvents, contractEvents, congressEvents] = await Promise.all([
    prisma.company.findMany({ select: { id: true, ticker: true, name: true, sector: true } }),
    prisma.insiderTransactionEvent.findMany({
      where: { resolvedCompanyId: { not: null }, transactionDate: { gte: since } },
    }),
    prisma.governmentContractEvent.findMany({
      where: { resolvedCompanyId: { not: null }, actionDate: { gte: since } },
    }),
    prisma.congressionalTransactionEvent.findMany({
      where: { resolvedCompanyId: { not: null }, transactionDate: { gte: since } },
    }),
  ]);

  const candidates: SignalCandidate[] = [];
  const snapshotWrites: Promise<unknown>[] = [];

  for (const company of companies) {
    const companyInsiderEvents = insiderEvents.filter((e) => e.resolvedCompanyId === company.id);
    const companyContractEvents = contractEvents.filter((e) => e.resolvedCompanyId === company.id);
    const companyCongressEvents = congressEvents.filter((e) => e.resolvedCompanyId === company.id);

    if (
      companyInsiderEvents.length === 0 &&
      companyContractEvents.length === 0 &&
      companyCongressEvents.length === 0
    ) {
      continue;
    }

    const result = computeEvidenceScore({
      asOf: now,
      insiderEvents: companyInsiderEvents.map((e) => ({
        reportingPersonName: e.reportingPersonName,
        relationshipCategory: e.relationshipCategory,
        classification: e.classification,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
        estimatedTotalValue: e.estimatedTotalValue ? Number(e.estimatedTotalValue) : null,
      })),
      contractEvents: companyContractEvents.map((e) => ({
        recordType: e.recordType,
        actionDate: e.actionDate.toISOString().slice(0, 10),
        newlyObligatedAmount: e.newlyObligatedAmount ? Number(e.newlyObligatedAmount) : null,
        resolutionConfidence: e.resolutionConfidence ? Number(e.resolutionConfidence) : null,
      })),
      congressEvents: companyCongressEvents.map((e) => ({
        politicianName: e.politicianName,
        transactionType: e.transactionType,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
        disclosureDelayDays: e.disclosureDelayDays,
        resolutionConfidence: e.resolutionConfidence ? Number(e.resolutionConfidence) : null,
      })),
    });

    if (result.totalScore === 0) continue;

    const allDates = [
      ...companyInsiderEvents.map((e) => e.transactionDate),
      ...companyContractEvents.map((e) => e.actionDate),
      ...companyCongressEvents.map((e) => e.transactionDate),
    ];
    const mostRecentEventDate =
      allDates.length > 0
        ? new Date(Math.max(...allDates.map((d) => d.getTime()))).toISOString().slice(0, 10)
        : null;

    candidates.push({
      ...result,
      companyId: company.id,
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      mostRecentEventDate,
      insiderEventCount: companyInsiderEvents.length,
      contractEventCount: companyContractEvents.length,
      congressEventCount: companyCongressEvents.length,
    });

    snapshotWrites.push(
      prismaService.signalSnapshot.create({
        data: {
          companyId: company.id,
          windowDays: window,
          totalScore: result.totalScore,
          insiderScore: result.components.insider,
          governmentContractScore: result.components.governmentContracts,
          congressScore: result.components.congress,
          convergenceBonus: result.components.convergenceBonus,
          confidence: result.confidence,
          categoriesMatched: result.categoriesMatched,
          explanations: result.explanations,
        },
      }),
    );
  }

  await Promise.allSettled(snapshotWrites);

  return candidates.sort((a, b) => b.totalScore - a.totalScore);
}

export async function getVennOverlapCounts(
  window: SignalWindow,
  now: Date = new Date(),
): Promise<VennOverlapCounts> {
  const candidates = await getSignalCandidates(window, now);

  const counts: VennOverlapCounts = {
    insiderOnly: 0,
    contractsOnly: 0,
    congressOnly: 0,
    insiderAndContracts: 0,
    insiderAndCongress: 0,
    contractsAndCongress: 0,
    allThree: 0,
    none: 0,
  };

  for (const c of candidates) {
    const hasInsider = c.insiderEventCount > 0;
    const hasContracts = c.contractEventCount > 0;
    const hasCongress = c.congressEventCount > 0;

    if (hasInsider && hasContracts && hasCongress) counts.allThree += 1;
    else if (hasInsider && hasContracts) counts.insiderAndContracts += 1;
    else if (hasInsider && hasCongress) counts.insiderAndCongress += 1;
    else if (hasContracts && hasCongress) counts.contractsAndCongress += 1;
    else if (hasInsider) counts.insiderOnly += 1;
    else if (hasContracts) counts.contractsOnly += 1;
    else if (hasCongress) counts.congressOnly += 1;
    else counts.none += 1;
  }

  return counts;
}

export interface SignalConvergenceSummary {
  companiesWithAnySignal: number;
  companiesWithTwoCategories: number;
  companiesWithThreeCategories: number;
  newSignalsToday: number;
}

export async function getSignalConvergenceSummary(
  window: SignalWindow,
  now: Date = new Date(),
): Promise<SignalConvergenceSummary> {
  const candidates = await getSignalCandidates(window, now);
  const todayStr = now.toISOString().slice(0, 10);

  return {
    companiesWithAnySignal: candidates.length,
    companiesWithTwoCategories: candidates.filter((c) => c.categoriesMatched >= 2).length,
    companiesWithThreeCategories: candidates.filter((c) => c.categoriesMatched === 3).length,
    newSignalsToday: candidates.filter((c) => c.mostRecentEventDate === todayStr).length,
  };
}
