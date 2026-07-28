import { forUser } from "@/lib/db/rls";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import type { PositionScenarioInput } from "@/features/scenario-analysis/lib/position-scenario";

export interface ScenarioPositionsResult {
  positions: PositionScenarioInput[];
  /** Tickers held but excluded because no live quote is available — shown so the gap is visible, not silently dropped. */
  excludedTickers: string[];
}

/**
 * Every held position with a live quote, ready to feed into
 * computePortfolioScenario(). Positions with no quote are excluded rather
 * than guessed at — see excludedTickers. Tenant data (Holding) via
 * forUser(); quotes come from the shared market-data provider, same as the
 * portfolio dashboard.
 */
export async function getScenarioPositionsForUser(userId: string): Promise<ScenarioPositionsResult> {
  const prisma = forUser(userId);

  const holdings = await prisma.holding.findMany({
    where: { quantity: { not: 0 } },
    include: { company: true },
  });

  const provider = getMarketDataProvider();
  const quoteEntries = await Promise.all(
    holdings.map(async (h) => [h.company.ticker, await provider.getQuote(h.company.ticker)] as const),
  );
  const quotes = new Map(quoteEntries);

  const positions: PositionScenarioInput[] = [];
  const excludedTickers: string[] = [];

  for (const holding of holdings) {
    const quote = quotes.get(holding.company.ticker);
    if (!quote) {
      excludedTickers.push(holding.company.ticker);
      continue;
    }
    positions.push({
      ticker: holding.company.ticker,
      quantity: Number(holding.quantity),
      averageCost: Number(holding.averageCost),
      currentPrice: Number(quote.price),
    });
  }

  return { positions, excludedTickers: [...new Set(excludedTickers)] };
}
