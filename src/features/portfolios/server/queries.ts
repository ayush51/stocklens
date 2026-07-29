import { forUser } from "@/lib/db/rls";
import type { Quote } from "@/shared/contracts/market-data-provider";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import { aggregatePortfolio, type HoldingInput, type HoldingSummary } from "./aggregate";

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

/**
 * All of a user's portfolios with non-zero holdings, enriched with live
 * quotes where available and split into stocks/ETFs for display (see
 * Company.assetType — ETFs resolve with no SEC CIK, so they're bucketed
 * separately rather than mixed in with fundamentals-backed holdings).
 *
 * RLS-scoped: Portfolio/Holding are tenant data, so this must go through
 * forUser(), never the service client. Quotes come from
 * getMarketDataProvider() — if FINNHUB_API_KEY isn't configured that's the
 * fail-closed "unavailable" provider, and every holding degrades to its
 * cost-basis estimate rather than the page breaking.
 */
export async function getPortfoliosForUser(userId: string): Promise<PortfolioSummary[]> {
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

  const allTickers = new Set(portfolios.flatMap((p) => p.holdings.map((h) => h.company.ticker)));
  const provider = getMarketDataProvider();
  const quoteEntries = await Promise.all(
    Array.from(allTickers).map(async (ticker) => [ticker, await provider.getQuote(ticker)] as const),
  );
  const quotes = new Map<string, Quote>(
    quoteEntries.filter((entry): entry is [string, Quote] => entry[1] !== null),
  );

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

  return portfolios.map((portfolio) => {
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
