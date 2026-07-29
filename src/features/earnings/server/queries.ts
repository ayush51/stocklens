import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { getPortfoliosForUser } from "@/features/portfolios/server/queries";
import { mapWithConcurrency } from "@/lib/concurrency";

/** Finnhub's free-tier rate limit is generous per-second but not unlimited — verified live that 36 simultaneous requests 429s several of them. */
const MAX_CONCURRENT_REQUESTS = 8;

export interface UpcomingEarningsRow {
  companyId: string;
  ticker: string;
  name: string;
  fiscalYear: number;
  fiscalPeriod: string;
  reportDate: string;
  timing: string | null;
  epsEstimate: string | null;
  revenueEstimate: string | null;
  allocationPct: string;
}

const LOOKAHEAD_DAYS = 120;

/**
 * Live, not DB-cached: unlike filings (immutable once published), upcoming
 * earnings estimates can be revised and new quarters roll in continuously,
 * so freshness matters more than avoiding a refetch. One provider call per
 * held company, bounded to MAX_CONCURRENT_REQUESTS in flight — verified
 * live that firing all requests at once (as portfolios/server/queries.ts
 * does for quotes, a lighter endpoint) 429s a meaningful fraction of
 * /calendar/earnings calls on Finnhub's free tier.
 */
export async function getUpcomingEarningsForUser(userId: string): Promise<UpcomingEarningsRow[]> {
  const portfolios = await getPortfoliosForUser(userId);
  const holdings = portfolios.flatMap((p) => [...p.stocks, ...p.etfs]);
  if (holdings.length === 0) return [];

  const provider = getMarketDataProvider();
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results = await mapWithConcurrency(holdings, MAX_CONCURRENT_REQUESTS, async (h) => {
    const entries = await provider.getEarningsCalendar(h.ticker, from, to);
    return entries.map((entry) => ({
      companyId: h.companyId,
      ticker: h.ticker,
      name: h.name,
      fiscalYear: entry.fiscalYear,
      fiscalPeriod: entry.fiscalPeriod,
      reportDate: entry.reportDate,
      timing: entry.timing,
      epsEstimate: entry.epsEstimate,
      revenueEstimate: entry.revenueEstimate,
      allocationPct: h.allocationPct,
    }));
  });

  return results.flat().sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}
