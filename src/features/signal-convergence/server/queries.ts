import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { mapWithConcurrency } from "@/lib/concurrency";
import { computeEvidenceScore, type ScoreResult } from "@/features/signal-convergence/lib/scoring";
import {
  resolveTimeframe,
  type SignalWindow,
  type SignalTimeframe,
} from "@/features/signal-convergence/lib/timeframe";

export type {
  SignalWindow,
  SignalDateRange,
  SignalTimeframe,
} from "@/features/signal-convergence/lib/timeframe";

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
  timeframe: SignalTimeframe,
  now: Date = new Date(),
): Promise<SignalCandidate[]> {
  const { since, asOf, windowDays } = resolveTimeframe(timeframe, now);

  const [companies, insiderEvents, contractEvents, congressEvents] = await Promise.all([
    prisma.company.findMany({ select: { id: true, ticker: true, name: true, sector: true } }),
    prisma.insiderTransactionEvent.findMany({
      where: { resolvedCompanyId: { not: null }, transactionDate: { gte: since, lte: asOf } },
    }),
    prisma.governmentContractEvent.findMany({
      where: { resolvedCompanyId: { not: null }, actionDate: { gte: since, lte: asOf } },
    }),
    prisma.congressionalTransactionEvent.findMany({
      where: { resolvedCompanyId: { not: null }, transactionDate: { gte: since, lte: asOf } },
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
      asOf,
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
          windowDays,
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
  timeframe: SignalTimeframe,
  now: Date = new Date(),
): Promise<VennOverlapCounts> {
  const candidates = await getSignalCandidates(timeframe, now);

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
    // Scored (not raw event-count) presence — matches categoriesMatched's
    // own definition exactly. A candidate with insider *sales* but no
    // purchases has insiderEventCount > 0 yet a real insider score of 0
    // (only purchases score), and must not show up as "has an insider
    // signal" in the Venn just because unrelated activity was logged.
    const hasInsider = c.components.insider > 0;
    const hasContracts = c.components.governmentContracts > 0;
    const hasCongress = c.components.congress > 0;

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

export interface CompanySignalDetail {
  companyId: string;
  ticker: string;
  name: string;
  score: ScoreResult;
  insiderEvents: Awaited<ReturnType<typeof prisma.insiderTransactionEvent.findMany>>;
  contractEvents: Awaited<ReturnType<typeof prisma.governmentContractEvent.findMany>>;
  congressEvents: Awaited<ReturnType<typeof prisma.congressionalTransactionEvent.findMany>>;
}

/** Full timeline (not just score-qualifying events) so the detail panel can show everything that happened, not just what scored. */
export async function getCompanySignalDetail(
  ticker: string,
  window: SignalWindow,
  now: Date = new Date(),
): Promise<CompanySignalDetail | null> {
  const company = await prisma.company.findFirst({ where: { ticker: ticker.toUpperCase() } });
  if (!company) return null;

  const { since } = resolveTimeframe(window, now);
  const [insiderEvents, contractEvents, congressEvents] = await Promise.all([
    prisma.insiderTransactionEvent.findMany({
      where: { resolvedCompanyId: company.id },
      orderBy: { transactionDate: "desc" },
      take: 50,
    }),
    prisma.governmentContractEvent.findMany({
      where: { resolvedCompanyId: company.id },
      orderBy: { actionDate: "desc" },
      take: 50,
    }),
    prisma.congressionalTransactionEvent.findMany({
      where: { resolvedCompanyId: company.id },
      orderBy: { transactionDate: "desc" },
      take: 50,
    }),
  ]);

  const score = computeEvidenceScore({
    asOf: now,
    insiderEvents: insiderEvents
      .filter((e) => e.transactionDate >= since)
      .map((e) => ({
        reportingPersonName: e.reportingPersonName,
        relationshipCategory: e.relationshipCategory,
        classification: e.classification,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
        estimatedTotalValue: e.estimatedTotalValue ? Number(e.estimatedTotalValue) : null,
      })),
    contractEvents: contractEvents
      .filter((e) => e.actionDate >= since)
      .map((e) => ({
        recordType: e.recordType,
        actionDate: e.actionDate.toISOString().slice(0, 10),
        newlyObligatedAmount: e.newlyObligatedAmount ? Number(e.newlyObligatedAmount) : null,
        resolutionConfidence: e.resolutionConfidence ? Number(e.resolutionConfidence) : null,
      })),
    congressEvents: congressEvents
      .filter((e) => e.transactionDate >= since)
      .map((e) => ({
        politicianName: e.politicianName,
        transactionType: e.transactionType,
        transactionDate: e.transactionDate.toISOString().slice(0, 10),
        disclosureDelayDays: e.disclosureDelayDays,
        resolutionConfidence: e.resolutionConfidence ? Number(e.resolutionConfidence) : null,
      })),
  });

  return {
    companyId: company.id,
    ticker: company.ticker,
    name: company.name,
    score,
    insiderEvents,
    contractEvents,
    congressEvents,
  };
}

export interface CandidatePriceInfo {
  price: string | null;
  isDelayed: boolean;
}

/**
 * Reuses the existing market-data provider (Finnhub, or the fail-closed
 * unavailable stub) rather than a new price integration — that provider
 * already has its own proven rate-limit pacing (see its own rate-limit
 * comment), so calling it per-ticker here needs no new pacing logic.
 * Bounded to whatever's actually on the candidate list (typically a
 * couple dozen companies at most), not the whole market.
 */
export async function getPricesForCandidates(tickers: string[]): Promise<Map<string, CandidatePriceInfo>> {
  const provider = getMarketDataProvider();
  const entries = await mapWithConcurrency(tickers, 6, async (ticker) => {
    const quote = await provider.getQuote(ticker);
    return [ticker, { price: quote?.price ?? null, isDelayed: quote?.isDelayed ?? true }] as const;
  });
  return new Map(entries);
}

export async function getSignalConvergenceSummary(
  timeframe: SignalTimeframe,
  now: Date = new Date(),
): Promise<SignalConvergenceSummary> {
  const candidates = await getSignalCandidates(timeframe, now);
  const todayStr = now.toISOString().slice(0, 10);

  return {
    companiesWithAnySignal: candidates.length,
    companiesWithTwoCategories: candidates.filter((c) => c.categoriesMatched >= 2).length,
    companiesWithThreeCategories: candidates.filter((c) => c.categoriesMatched === 3).length,
    newSignalsToday: candidates.filter((c) => c.mostRecentEventDate === todayStr).length,
  };
}
