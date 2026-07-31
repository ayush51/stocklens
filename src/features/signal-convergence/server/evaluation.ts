import { prismaService } from "@/lib/db/prisma-service";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { mapWithConcurrency } from "@/lib/concurrency";
import {
  bucketSamples,
  computeForwardReturnPct,
  findClosestBarOnOrBefore,
  MIN_SAMPLE_SIZE_FOR_AVERAGE,
  type SignalPerformanceBucket,
} from "@/features/signal-convergence/lib/evaluation";

/**
 * How far forward to look for a real exit price. 14 days (not the
 * snapshot's own windowDays) so a 7-day-window signal and a 90-day-window
 * signal are compared on the same forward horizon — the window controls
 * how far back evidence is gathered, not how far forward performance is
 * measured, and mixing the two would make bucket averages incomparable
 * across window sizes.
 */
const EVALUATION_HORIZON_DAYS = 14;
const MAX_SNAPSHOTS_CONSIDERED = 500;

export interface SignalPerformanceRow {
  companyId: string;
  ticker: string;
  name: string;
  snapshotDate: string;
  windowDays: number;
  totalScore: number;
  categoriesMatched: number;
  entryPrice: number | null;
  exitPrice: number | null;
  forwardReturnPct: number | null;
}

export interface SignalPerformanceSummary {
  horizonDays: number;
  minSampleSizeForAverage: number;
  buckets: SignalPerformanceBucket[];
  rows: SignalPerformanceRow[];
}

/**
 * "How did prior signals perform" using only real data already on file:
 * SignalSnapshot rows this app already wrote as a side effect of normal
 * candidate-table usage, and real historical closes from the market-data
 * provider (Finnhub/Yahoo fallback — see that provider's own comment) for
 * the specific two dates each snapshot needs. Never estimates or
 * interpolates a price the provider didn't actually return — a missing
 * bar means `entryPrice`/`exitPrice`/`forwardReturnPct` stay null, and
 * that sample is excluded from bucket averages (but still counted) rather
 * than silently dropped or guessed.
 */
export async function getSignalPerformanceHistory(now: Date = new Date()): Promise<SignalPerformanceSummary> {
  const horizonMs = EVALUATION_HORIZON_DAYS * 24 * 60 * 60 * 1000;
  const eligibleBefore = new Date(now.getTime() - horizonMs);

  const snapshots = await prismaService.signalSnapshot.findMany({
    where: { computedAt: { lte: eligibleBefore } },
    orderBy: { computedAt: "desc" },
    take: MAX_SNAPSHOTS_CONSIDERED,
    include: { company: { select: { ticker: true, name: true } } },
  });

  // Repeated page loads write a new SignalSnapshot row every time (see
  // queries.ts's own comment on why) — evaluating every single one would
  // massively over-weight companies whose pages just got viewed more
  // often, not companies with more actual signal days. One row per
  // (company, window, calendar day) — the first one encountered per key,
  // since snapshots are already ordered most-recent-first — stands in for
  // "the signal as of that day."
  const seen = new Set<string>();
  const deduped: typeof snapshots = [];
  for (const s of snapshots) {
    const dayKey = s.computedAt.toISOString().slice(0, 10);
    const key = `${s.companyId}:${s.windowDays}:${dayKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(s);
  }

  const byCompany = new Map<string, typeof deduped>();
  for (const s of deduped) {
    const list = byCompany.get(s.companyId) ?? [];
    list.push(s);
    byCompany.set(s.companyId, list);
  }

  const provider = getMarketDataProvider();
  const rowsByCompany = await mapWithConcurrency(
    Array.from(byCompany.entries()),
    6,
    async ([companyId, companySnapshots]) => {
      const ticker = companySnapshots[0].company.ticker;
      const name = companySnapshots[0].company.name;
      const dates = companySnapshots.map((s) => s.computedAt);
      const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
      const latest = new Date(Math.max(...dates.map((d) => d.getTime())));
      const from = earliest.toISOString().slice(0, 10);
      const to = new Date(latest.getTime() + horizonMs).toISOString().slice(0, 10);

      const bars = await provider.getHistoricalPrices(ticker, from, to);

      return companySnapshots.map((s): SignalPerformanceRow => {
        const snapshotDate = s.computedAt.toISOString().slice(0, 10);
        const exitTargetDate = new Date(s.computedAt.getTime() + horizonMs).toISOString().slice(0, 10);
        const entryBar = findClosestBarOnOrBefore(bars, snapshotDate);
        const exitBar = findClosestBarOnOrBefore(bars, exitTargetDate);
        const entryPrice = entryBar ? Number(entryBar.close) : null;
        const exitPrice = exitBar && exitBar.date !== entryBar?.date ? Number(exitBar.close) : null;

        return {
          companyId,
          ticker,
          name,
          snapshotDate,
          windowDays: s.windowDays,
          totalScore: s.totalScore,
          categoriesMatched: s.categoriesMatched,
          entryPrice,
          exitPrice,
          forwardReturnPct:
            entryPrice !== null && exitPrice !== null ? computeForwardReturnPct(entryPrice, exitPrice) : null,
        };
      });
    },
  );

  const rows = rowsByCompany.flat().sort((a, b) => (a.snapshotDate < b.snapshotDate ? 1 : -1));
  const buckets = bucketSamples(
    rows.map((r) => ({ totalScore: r.totalScore, forwardReturnPct: r.forwardReturnPct })),
  );

  return {
    horizonDays: EVALUATION_HORIZON_DAYS,
    minSampleSizeForAverage: MIN_SAMPLE_SIZE_FOR_AVERAGE,
    buckets,
    rows,
  };
}
