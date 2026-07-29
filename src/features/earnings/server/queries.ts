import { forUser } from "@/lib/db/rls";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { mapWithConcurrency } from "@/lib/concurrency";

/**
 * Real rate-limit enforcement lives inside the Finnhub client itself now
 * (a serialized dispatch queue paced to Finnhub's actual free-tier limit —
 * see providers/finnhub/index.ts). This just bounds how many requests are
 * queued up at once from this one caller, as a second layer.
 */
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
}

const LOOKAHEAD_DAYS = 120;

/**
 * Live, not DB-cached: unlike filings (immutable once published), upcoming
 * earnings estimates can be revised and new quarters roll in continuously,
 * so freshness matters more than avoiding a refetch.
 *
 * Reads held companies directly (ticker/name only) rather than through
 * getPortfoliosForUser, which also fetches a live quote per holding to
 * compute market value/allocation — real cost once the Finnhub client's
 * rate-limit pacing was fixed (verified live: doubled this page's load
 * time from ~38s to ~76s, since it was paying for two full paced fetches
 * of the same 36 holdings back to back). This feature never displays
 * price/allocation data, so there was nothing to justify paying for it.
 */
export async function getUpcomingEarningsForUser(userId: string): Promise<UpcomingEarningsRow[]> {
  const prisma = forUser(userId);
  const holdings = await prisma.holding.findMany({
    where: { quantity: { not: 0 } },
    include: { company: true },
  });
  if (holdings.length === 0) return [];

  // A company can appear in more than one portfolio (e.g. a manual
  // portfolio and a Robinhood-synced one) — de-duplicate so its earnings
  // date isn't fetched or shown twice.
  const uniqueCompanies = [...new Map(holdings.map((h) => [h.companyId, h.company])).values()];

  const provider = getMarketDataProvider();
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const results = await mapWithConcurrency(uniqueCompanies, MAX_CONCURRENT_REQUESTS, async (company) => {
    const entries = await provider.getEarningsCalendar(company.ticker, from, to);
    return entries.map((entry) => ({
      companyId: company.id,
      ticker: company.ticker,
      name: company.name,
      fiscalYear: entry.fiscalYear,
      fiscalPeriod: entry.fiscalPeriod,
      reportDate: entry.reportDate,
      timing: entry.timing,
      epsEstimate: entry.epsEstimate,
      revenueEstimate: entry.revenueEstimate,
    }));
  });

  return results.flat().sort((a, b) => a.reportDate.localeCompare(b.reportDate));
}
