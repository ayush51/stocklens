import { prisma } from "@/lib/db/prisma";
import { forUser } from "@/lib/db/rls";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { mapWithConcurrency } from "@/lib/concurrency";
import { persistEarningsEvents } from "@/features/earnings/server/persist";
import { computeEarningsSurprise, type EarningsSurprise } from "@/features/earnings/lib/surprise";

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

  const rows = results.flat().sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  await persistEarningsEvents(rows);
  return rows;
}

export interface PastEarningsRow {
  earningsEventId: string;
  companyId: string;
  ticker: string;
  name: string;
  fiscalYear: number;
  fiscalPeriod: string;
  reportDate: string;
  epsEstimate: string | null;
  epsActual: string | null;
  epsSurprise: EarningsSurprise;
  revenueEstimate: string | null;
  revenueActual: string | null;
  revenueSurprise: EarningsSurprise;
  review: { notes: string; affectsThesis: boolean; createdAt: string } | null;
}

const PAST_EARNINGS_LOOKBACK = 8; // most recent reports per company, not a hard date cutoff

/**
 * Only covers reports captured by persistEarningsEvents while they were
 * still upcoming (see that function's doc comment for why — Finnhub's
 * free tier never hands back historical estimates). A holding added after
 * its last report, or one whose report passed before this feature
 * shipped, will have no rows here until its next report comes and goes —
 * real, honest history builds up over time, nothing is backfilled or
 * invented for the gap.
 *
 * epsActual/revenueActual come from FinancialStatement (real SEC EDGAR
 * XBRL data), joined by companyId + fiscalYear + fiscalPeriod — Finnhub
 * never supplies actuals on the free tier either (see
 * EarningsCalendarEntry's doc comment).
 */
export async function getPastEarningsForUser(userId: string): Promise<PastEarningsRow[]> {
  const prismaUser = forUser(userId);
  const holdings = await prismaUser.holding.findMany({
    where: { quantity: { not: 0 } },
    include: { company: true },
  });
  if (holdings.length === 0) return [];

  const uniqueCompanies = [...new Map(holdings.map((h) => [h.companyId, h.company])).values()];
  const companyIds = uniqueCompanies.map((c) => c.id);
  const companyById = new Map(uniqueCompanies.map((c) => [c.id, c]));

  const events = await prisma.earningsEvent.findMany({
    where: { companyId: { in: companyIds }, reportDate: { lt: new Date() } },
    orderBy: { reportDate: "desc" },
  });

  if (events.length === 0) return [];

  const statements = await prisma.financialStatement.findMany({
    where: {
      companyId: { in: companyIds },
      fiscalPeriod: { in: ["Q1", "Q2", "Q3", "Q4"] },
    },
    select: { companyId: true, fiscalYear: true, fiscalPeriod: true, eps: true, revenue: true },
  });
  const statementByKey = new Map(
    statements.map((s) => [`${s.companyId}-${s.fiscalYear}-${s.fiscalPeriod}`, s]),
  );

  const reviews = await prismaUser.earningsReview.findMany({
    where: { earningsEventId: { in: events.map((e) => e.id) } },
  });
  const reviewByEventId = new Map(reviews.map((r) => [r.earningsEventId, r]));

  // Cap per company so one long-held stock doesn't crowd out everything else.
  const perCompanyCount = new Map<string, number>();

  const rows: PastEarningsRow[] = [];
  for (const event of events) {
    const seen = perCompanyCount.get(event.companyId) ?? 0;
    if (seen >= PAST_EARNINGS_LOOKBACK) continue;
    perCompanyCount.set(event.companyId, seen + 1);

    const company = companyById.get(event.companyId);
    if (!company) continue;

    const statement = statementByKey.get(`${event.companyId}-${event.fiscalYear}-${event.fiscalPeriod}`);
    const epsEstimate = event.epsEstimate?.toString() ?? null;
    const epsActual = statement?.eps?.toString() ?? null;
    const revenueEstimate = event.revenueEstimate?.toString() ?? null;
    const revenueActual = statement?.revenue?.toString() ?? null;
    const review = reviewByEventId.get(event.id);

    rows.push({
      earningsEventId: event.id,
      companyId: event.companyId,
      ticker: company.ticker,
      name: company.name,
      fiscalYear: event.fiscalYear,
      fiscalPeriod: event.fiscalPeriod,
      reportDate: event.reportDate.toISOString().slice(0, 10),
      epsEstimate,
      epsActual,
      epsSurprise: computeEarningsSurprise(epsEstimate, epsActual),
      revenueEstimate,
      revenueActual,
      revenueSurprise: computeEarningsSurprise(revenueEstimate, revenueActual),
      review: review
        ? {
            notes: review.notes,
            affectsThesis: review.affectsThesis,
            createdAt: review.createdAt.toISOString(),
          }
        : null,
    });
  }

  return rows;
}
