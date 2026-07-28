/**
 * Position/portfolio "what if" calculators. Purely computational — no
 * persistence, no forecast, no probability attached to any scenario. See
 * the disclaimer every scenario view must show: "Scenarios are not
 * forecasts." This module only answers "what would my numbers look like
 * if the price were X," never "what will the price be."
 */

export const STANDARD_SHOCK_PERCENTAGES = [-50, -30, -20, -10, 0, 10, 20, 30, 50] as const;

export interface PositionScenarioInput {
  ticker: string;
  quantity: number;
  averageCost: number;
  currentPrice: number;
}

export interface PositionScenarioResult {
  ticker: string;
  scenarioPrice: number;
  positionMarketValue: number;
  gainLoss: number;
  gainLossPct: number;
  /** How far the scenario price is from the user's own cost basis, signed. */
  distanceFromCostBasisPct: number;
}

export function computePositionScenarioAtPrice(
  input: PositionScenarioInput,
  scenarioPrice: number,
): PositionScenarioResult {
  const positionMarketValue = scenarioPrice * input.quantity;
  const costBasis = input.averageCost * input.quantity;
  const gainLoss = positionMarketValue - costBasis;
  const gainLossPct = costBasis !== 0 ? (gainLoss / Math.abs(costBasis)) * 100 : 0;
  const distanceFromCostBasisPct =
    input.averageCost !== 0 ? ((scenarioPrice - input.averageCost) / input.averageCost) * 100 : 0;

  return {
    ticker: input.ticker,
    scenarioPrice,
    positionMarketValue,
    gainLoss,
    gainLossPct,
    distanceFromCostBasisPct,
  };
}

export function computePositionScenarioAtShock(
  input: PositionScenarioInput,
  shockPct: number,
): PositionScenarioResult {
  return computePositionScenarioAtPrice(input, input.currentPrice * (1 + shockPct / 100));
}

export interface PortfolioScenarioInput {
  /** Every position with a live quote — positions without one are excluded, never guessed. */
  positions: PositionScenarioInput[];
  /** Tickers the shock applies to. Empty/all/one — this is how single-stock, sector, broad-market, correlated-drawdown, and custom multi-position shocks are all expressed: which tickers are in this set. */
  shockedTickers: ReadonlySet<string>;
  shockPct: number;
}

export interface PortfolioScenarioResult {
  baselineMarketValue: number;
  scenarioMarketValue: number;
  portfolioImpact: number;
  portfolioImpactPct: number;
  positions: (PositionScenarioResult & { wasShocked: boolean; allocationPct: number })[];
}

export function computePortfolioScenario(input: PortfolioScenarioInput): PortfolioScenarioResult {
  let baselineMarketValue = 0;
  const rows: (PositionScenarioResult & { wasShocked: boolean })[] = [];

  for (const position of input.positions) {
    baselineMarketValue += position.currentPrice * position.quantity;

    const wasShocked = input.shockedTickers.has(position.ticker);
    const scenarioPrice = wasShocked
      ? position.currentPrice * (1 + input.shockPct / 100)
      : position.currentPrice;
    rows.push({ ...computePositionScenarioAtPrice(position, scenarioPrice), wasShocked });
  }

  const scenarioMarketValue = rows.reduce((sum, r) => sum + r.positionMarketValue, 0);
  const portfolioImpact = scenarioMarketValue - baselineMarketValue;
  const portfolioImpactPct = baselineMarketValue !== 0 ? (portfolioImpact / baselineMarketValue) * 100 : 0;

  const positions = rows.map((r) => ({
    ...r,
    allocationPct: scenarioMarketValue !== 0 ? (r.positionMarketValue / scenarioMarketValue) * 100 : 0,
  }));

  return { baselineMarketValue, scenarioMarketValue, portfolioImpact, portfolioImpactPct, positions };
}
