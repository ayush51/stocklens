import type { Quote } from "@/shared/contracts/market-data-provider";

/** Beyond this, a quote is shown to the user as stale rather than live. */
export const DEFAULT_STALENESS_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export function isQuoteStale(
  quote: Pick<Quote, "marketTimestamp">,
  now: Date = new Date(),
  thresholdMs: number = DEFAULT_STALENESS_THRESHOLD_MS,
): boolean {
  const ageMs = now.getTime() - new Date(quote.marketTimestamp).getTime();
  return ageMs > thresholdMs;
}
