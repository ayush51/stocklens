export type ValuationPositionState =
  "BELOW_RANGE" | "LOWER_HALF" | "UPPER_HALF" | "ABOVE_RANGE" | "INSUFFICIENT_DATA";

export interface ValuationPositionResult {
  state: ValuationPositionState;
  formula: string;
  /** 0 = at the 52-week low, 100 = at the 52-week high. Can fall outside [0,100] if the price has moved past either bound since it was last observed. */
  percentileWithinRange: number | null;
  comparisonPeriods: string | null;
  confidence: "PROVIDER_SUPPLIED";
  sourceTimestamp: Date;
}

/**
 * This is deliberately narrower than "historical valuation percentile"
 * (instructions.md §7/§9) — that would need a stored history of the
 * company's own P/E or EV/EBITDA over time, which this app doesn't
 * persist yet (ratios are fetched live, point-in-time, from
 * company-ratios/server/queries.ts). What IS available right now, for
 * real: today's price relative to its own real 52-week high/low
 * (Finnhub-reported, already surfaced in the ratios panel). That's a
 * legitimate, narrower signal — price position within its own trading
 * range — not a claim about earnings-multiple valuation history. Labeled
 * accordingly rather than overclaiming.
 */
export function computeValuationPosition(
  currentPrice: string | null,
  week52High: string | null,
  week52Low: string | null,
  asOf: string,
): ValuationPositionResult {
  const formula =
    "Current price position within the 52-week high/low range: (price - low) / (high - low) * 100";
  const sourceTimestamp = new Date(asOf);

  const price = currentPrice !== null ? Number(currentPrice) : null;
  const high = week52High !== null ? Number(week52High) : null;
  const low = week52Low !== null ? Number(week52Low) : null;

  if (price === null || high === null || low === null || high <= low) {
    return {
      state: "INSUFFICIENT_DATA",
      formula,
      percentileWithinRange: null,
      comparisonPeriods: null,
      confidence: "PROVIDER_SUPPLIED",
      sourceTimestamp,
    };
  }

  const percentileWithinRange = Math.round(((price - low) / (high - low)) * 1000) / 10;
  const state: ValuationPositionState =
    percentileWithinRange < 0
      ? "BELOW_RANGE"
      : percentileWithinRange > 100
        ? "ABOVE_RANGE"
        : percentileWithinRange < 50
          ? "LOWER_HALF"
          : "UPPER_HALF";

  return {
    state,
    formula,
    percentileWithinRange,
    comparisonPeriods: `52-week range $${low.toFixed(2)} - $${high.toFixed(2)}, currently $${price.toFixed(2)}`,
    confidence: "PROVIDER_SUPPLIED",
    sourceTimestamp,
  };
}
