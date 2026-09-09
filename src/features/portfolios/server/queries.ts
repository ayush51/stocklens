import { forUser } from "@/lib/db/rls";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { getCachedQuotes } from "@/features/market-data/server/quote-cache";
import {
  aggregatePortfolio,
  type HoldingInput,
  type HoldingSummary,
  type PortfolioAggregate,
} from "./aggregate";

export interface PortfolioSummary {
  id: string;
  name: string;
  source: string;
  lastSyncedAt: Date | null;
  investedCapital: string;
  estimatedMarketValue: string;
  isPartial: boolean;
  totalUnrealizedGainLoss: string | null;
  totalUnrealizedGainLossPct: string | null;
  totalDailyGainLoss: string | null;
  totalRealizedGainLoss: string;
  isRealizedGainLossPartial: boolean;
  largestPositions: HoldingSummary[];
  concentrationWarnings: HoldingSummary[];
  stocks: HoldingSummary[];
  etfs: HoldingSummary[];
}

export interface DashboardSummary extends PortfolioAggregate {
  portfolioCount: number;
}

/**
 * Shared fetch: every portfolio + non-zero holdings, live quotes for every
 * held ticker across all of them, and per-portfolio HoldingInput[] ready
 * for aggregatePortfolio(). Both a per-portfolio view (getPortfoliosForUser)
 * and the cross-portfolio rollup (getDashboardSummary) build on this so the
 * quote fetch and Transaction lookups only happen once.
 *
 * RLS-scoped: Portfolio/Holding are tenant data, so this must go through
 * forUser(), never the service client. Quotes come from
 * getCachedQuotes() (backed by getMarketDataProvider() underneath) — if
 * FINNHUB_API_KEY isn't configured that's the fail-closed "unavailable"
 * provider, and every holding degrades to its cost-basis estimate rather
 * than the page breaking. A held portfolio easily has 30+ distinct
 * tickers, and fetching all of them live on every page load would take
 * 30+ seconds serialized through Finnhub's real rate limit — the cache
 * turns a repeat load into a single DB query for the common case.
 */
async function fetchHoldingsByPortfolio(userId: string, opts?: { forceRefreshQuotes?: boolean }) {
  const prisma = forUser(userId);

  const portfolios = await prisma.portfolio.findMany({
    include: {
      brokerageConnection: true,
      holdings: {
        where: { quantity: { not: 0 } },
        include: { company: true },
        orderBy: { company: { ticker: "asc" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const allTickers = Array.from(new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.company.ticker))));
  const provider = getMarketDataProvider();
  const quotes = await getCachedQuotes(allTickers, provider, {
    forceRefresh: opts?.forceRefreshQuotes,
  });

  // realizedGainLoss is only a real derived figure for holdings with actual
  // Transaction rows behind them (see recomputeHolding) — a Robinhood MCP
  // snapshot sync writes quantity/averageCost directly and never creates
  // any Transaction, leaving the schema default (0) in place forever. One
  // query per portfolio for which companyIds have transaction history,
  // rather than N+1 per holding.
  const transactedCompanyIdsByPortfolio = new Map<string, Set<string>>();
  for (const portfolio of portfolios) {
    const rows = await prisma.transaction.findMany({
      where: { portfolioId: portfolio.id, companyId: { not: null } },
      distinct: ["companyId"],
      select: { companyId: true },
    });
    transactedCompanyIdsByPortfolio.set(
      portfolio.id,
      new Set(rows.map((r) => r.companyId).filter((id): id is string => id !== null)),
    );
  }

  const holdingInputsByPortfolioId = new Map<string, HoldingInput[]>(
    portfolios.map((portfolio) => {
      const transactedCompanyIds = transactedCompanyIdsByPortfolio.get(portfolio.id) ?? new Set();
      const holdingInputs: HoldingInput[] = portfolio.holdings.map((holding) => ({
        companyId: holding.companyId,
        ticker: holding.company.ticker,
        name: holding.company.name,
        assetType: holding.company.assetType,
        quantity: holding.quantity,
        averageCost: holding.averageCost,
        realizedGainLoss: holding.realizedGainLoss,
        realizedGainLossTracked: transactedCompanyIds.has(holding.companyId),
      }));
      return [portfolio.id, holdingInputs];
    }),
  );

  return { portfolios, holdingInputsByPortfolioId, quotes };
}

/**
 * All of a user's portfolios with non-zero holdings, enriched with live
 * quotes where available and split into stocks/ETFs for display (see
 * Company.assetType — ETFs resolve with no SEC CIK, so they're bucketed
 * separately rather than mixed in with fundamentals-backed holdings).
 */
export async function getPortfoliosForUser(
  userId: string,
  opts?: { forceRefreshQuotes?: boolean },
): Promise<PortfolioSummary[]> {
  const { portfolios, holdingInputsByPortfolioId, quotes } = await fetchHoldingsByPortfolio(userId, opts);

  return portfolios.map((portfolio) => {
    const holdingInputs = holdingInputsByPortfolioId.get(portfolio.id) ?? [];
    const aggregate = aggregatePortfolio(holdingInputs, quotes);

    const stocks: HoldingSummary[] = [];
    const etfs: HoldingSummary[] = [];
    for (const summary of aggregate.holdings) {
      (summary.assetType === "ETF" ? etfs : stocks).push(summary);
    }

    return {
      id: portfolio.id,
      name: portfolio.name,
      source: portfolio.source,
      lastSyncedAt: portfolio.brokerageConnection?.lastSyncedAt ?? null,
      investedCapital: aggregate.investedCapital,
      estimatedMarketValue: aggregate.estimatedMarketValue,
      isPartial: aggregate.isPartial,
      totalUnrealizedGainLoss: aggregate.totalUnrealizedGainLoss,
      totalUnrealizedGainLossPct: aggregate.totalUnrealizedGainLossPct,
      totalDailyGainLoss: aggregate.totalDailyGainLoss,
      totalRealizedGainLoss: aggregate.totalRealizedGainLoss,
      isRealizedGainLossPartial: aggregate.isRealizedGainLossPartial,
      largestPositions: aggregate.largestPositions,
      concentrationWarnings: aggregate.concentrationWarnings,
      stocks,
      etfs,
    };
  });
}

/**
 * Cross-portfolio rollup for the dashboard — merges every portfolio's
 * holdings into a single aggregatePortfolio() call so invested capital,
 * market value, gain/loss, and allocation reflect the user's whole book
 * rather than one portfolio at a time (each portfolio's own allocationPct
 * is only relative to itself, so those can't just be summed/concatenated).
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const { portfolios, holdingInputsByPortfolioId, quotes } = await fetchHoldingsByPortfolio(userId);
  const allHoldingInputs = portfolios.flatMap((p) => holdingInputsByPortfolioId.get(p.id) ?? []);
  const aggregate = aggregatePortfolio(allHoldingInputs, quotes);
  return { ...aggregate, portfolioCount: portfolios.length };
}
