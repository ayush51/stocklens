export type EarningsSurpriseClassification = "BEAT" | "MISS" | "INLINE" | "NO_ESTIMATE" | "NOT_YET_REPORTED";

export interface EarningsSurprise {
  surprisePct: number | null;
  classification: EarningsSurpriseClassification;
}

// Matches the STABLE_BAND convention in company-analysis/lib/growth-trend.ts —
// small deviations are normal estimate noise, not a real beat or miss.
const INLINE_BAND_PCT = 2;

/**
 * Pure, deterministic (instructions.md §11). `actual` is null whenever the
 * company hasn't filed a matching FinancialStatement yet for this fiscal
 * period — NOT_YET_REPORTED, not a fabricated 0. `estimate` is null when
 * Finnhub never had a consensus estimate for this report — NO_ESTIMATE,
 * distinct from NOT_YET_REPORTED so the UI can say which is missing.
 */
export function computeEarningsSurprise(estimate: string | null, actual: string | null): EarningsSurprise {
  if (actual === null) return { surprisePct: null, classification: "NOT_YET_REPORTED" };
  if (estimate === null) return { surprisePct: null, classification: "NO_ESTIMATE" };

  const estimateNum = Number(estimate);
  const actualNum = Number(actual);
  if (!Number.isFinite(estimateNum) || !Number.isFinite(actualNum) || estimateNum === 0) {
    return { surprisePct: null, classification: "NO_ESTIMATE" };
  }

  const surprisePct = ((actualNum - estimateNum) / Math.abs(estimateNum)) * 100;
  const classification: EarningsSurpriseClassification =
    Math.abs(surprisePct) < INLINE_BAND_PCT ? "INLINE" : surprisePct > 0 ? "BEAT" : "MISS";

  return { surprisePct, classification };
}
