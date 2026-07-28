import { Prisma } from "@/generated/prisma/client";
import type { Quote } from "@/shared/contracts/market-data-provider";
import { isQuoteStale } from "@/features/market-data/server/staleness";

/** No user-configurable allocation ceiling exists yet (see task: manual
 * settings / UserPreference.maxPositionAllocation). Flag anything above
 * this fixed default rather than silently having no concentration signal
 * at all. */
export const DEFAULT_CONCENTRATION_THRESHOLD_PCT = 10;

export interface HoldingInput {
  companyId: string;
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  quantity: Prisma.Decimal | string;
  averageCost: Prisma.Decimal | string;
  realizedGainLoss: Prisma.Decimal | string;
}

export interface HoldingSummary {
  companyId: string;
  ticker: string;
  name: string;
  assetType: "STOCK" | "ETF";
  quantity: string;
  averageCost: string;
  costBasis: string;
  realizedGainLoss: string;
  /** null when no live quote is available for this ticker. */
  marketValue: string | null;
  unrealizedGainLoss: string | null;
  unrealizedGainLossPct: string | null;
  dailyGainLoss: string | null;
  dailyGainLossPct: string | null;
  /** Share of portfolio value, using market value where known and cost basis as a fallback. */
  allocationPct: string;
  isStale: boolean;
  quoteUnavailable: boolean;
  isOverConcentrationThreshold: boolean;
}

export interface PortfolioAggregate {
  investedCapital: string;
  /** Sum of holdings' best-available value (market value if known, cost basis otherwise). */
  estimatedMarketValue: string;
  /** True if any holding is missing a live quote — estimatedMarketValue is a mix of real and cost-basis figures. */
  isPartial: boolean;
  totalUnrealizedGainLoss: string | null;
  totalUnrealizedGainLossPct: string | null;
  totalDailyGainLoss: string | null;
  totalRealizedGainLoss: string;
  holdings: HoldingSummary[];
  largestPositions: HoldingSummary[];
  concentrationWarnings: HoldingSummary[];
}

function decimal(value: Prisma.Decimal | string): Prisma.Decimal {
  return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
}

/**
 * Pure aggregation over a portfolio's holdings plus whatever quotes are
 * available for them. Takes quotes as a plain map rather than calling the
 * market-data provider itself, so it's fully unit-testable with synthetic
 * data and has no I/O of its own.
 */
export function aggregatePortfolio(
  holdings: HoldingInput[],
  quotes: Map<string, Quote>,
  now: Date = new Date(),
): PortfolioAggregate {
  let investedCapital = new Prisma.Decimal(0);
  let estimatedMarketValue = new Prisma.Decimal(0);
  let totalUnrealizedGainLoss = new Prisma.Decimal(0);
  let totalDailyGainLoss = new Prisma.Decimal(0);
  let totalRealizedGainLoss = new Prisma.Decimal(0);
  let isPartial = false;
  let hasAnyQuote = false;

  const provisional = holdings.map((holding) => {
    const quantity = decimal(holding.quantity);
    const averageCost = decimal(holding.averageCost);
    const realizedGainLoss = decimal(holding.realizedGainLoss);
    const costBasis = quantity.times(averageCost);
    const quote = quotes.get(holding.ticker);

    investedCapital = investedCapital.plus(costBasis);
    totalRealizedGainLoss = totalRealizedGainLoss.plus(realizedGainLoss);

    let marketValue: Prisma.Decimal | null = null;
    let unrealizedGainLoss: Prisma.Decimal | null = null;
    let unrealizedGainLossPct: Prisma.Decimal | null = null;
    let dailyGainLoss: Prisma.Decimal | null = null;
    let dailyGainLossPct: Prisma.Decimal | null = null;

    if (quote) {
      hasAnyQuote = true;
      const price = new Prisma.Decimal(quote.price);
      marketValue = quantity.times(price);
      unrealizedGainLoss = marketValue.minus(costBasis);
      unrealizedGainLossPct = costBasis.greaterThan(0)
        ? unrealizedGainLoss.dividedBy(costBasis).times(100)
        : new Prisma.Decimal(0);

      if (quote.previousClose) {
        const previousClose = new Prisma.Decimal(quote.previousClose);
        dailyGainLoss = price.minus(previousClose).times(quantity);
        dailyGainLossPct = previousClose.greaterThan(0)
          ? price.minus(previousClose).dividedBy(previousClose).times(100)
          : new Prisma.Decimal(0);
      }

      estimatedMarketValue = estimatedMarketValue.plus(marketValue);
      totalUnrealizedGainLoss = totalUnrealizedGainLoss.plus(unrealizedGainLoss);
      if (dailyGainLoss) totalDailyGainLoss = totalDailyGainLoss.plus(dailyGainLoss);
    } else {
      isPartial = true;
      estimatedMarketValue = estimatedMarketValue.plus(costBasis); // fallback estimate
    }

    return {
      holding,
      quantity,
      averageCost,
      realizedGainLoss,
      costBasis,
      quote: quote ?? null,
      marketValue,
      unrealizedGainLoss,
      unrealizedGainLossPct,
      dailyGainLoss,
      dailyGainLossPct,
    };
  });

  const holdingSummaries: HoldingSummary[] = provisional.map((p) => {
    const bestValue = p.marketValue ?? p.costBasis;
    const allocationPct = estimatedMarketValue.greaterThan(0)
      ? bestValue.dividedBy(estimatedMarketValue).times(100)
      : new Prisma.Decimal(0);

    return {
      companyId: p.holding.companyId,
      ticker: p.holding.ticker,
      name: p.holding.name,
      assetType: p.holding.assetType,
      quantity: p.quantity.toString(),
      averageCost: p.averageCost.toString(),
      costBasis: p.costBasis.toString(),
      realizedGainLoss: p.realizedGainLoss.toString(),
      marketValue: p.marketValue?.toString() ?? null,
      unrealizedGainLoss: p.unrealizedGainLoss?.toString() ?? null,
      unrealizedGainLossPct: p.unrealizedGainLossPct?.toString() ?? null,
      dailyGainLoss: p.dailyGainLoss?.toString() ?? null,
      dailyGainLossPct: p.dailyGainLossPct?.toString() ?? null,
      allocationPct: allocationPct.toString(),
      isStale: p.quote ? isQuoteStale(p.quote, now) : false,
      quoteUnavailable: p.quote === null,
      isOverConcentrationThreshold: allocationPct.greaterThan(DEFAULT_CONCENTRATION_THRESHOLD_PCT),
    };
  });

  const largestPositions = [...holdingSummaries]
    .sort((a, b) => new Prisma.Decimal(b.allocationPct).comparedTo(new Prisma.Decimal(a.allocationPct)))
    .slice(0, 5);

  const concentrationWarnings = holdingSummaries.filter((h) => h.isOverConcentrationThreshold);

  return {
    investedCapital: investedCapital.toString(),
    estimatedMarketValue: estimatedMarketValue.toString(),
    isPartial,
    totalUnrealizedGainLoss: hasAnyQuote ? totalUnrealizedGainLoss.toString() : null,
    totalUnrealizedGainLossPct:
      hasAnyQuote && investedCapital.greaterThan(0)
        ? totalUnrealizedGainLoss.dividedBy(investedCapital).times(100).toString()
        : null,
    totalDailyGainLoss: hasAnyQuote ? totalDailyGainLoss.toString() : null,
    totalRealizedGainLoss: totalRealizedGainLoss.toString(),
    holdings: holdingSummaries,
    largestPositions,
    concentrationWarnings,
  };
}
