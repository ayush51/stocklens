import type { CriterionStatus } from "./suggest-status";

export type ThesisTrend = "STRENGTHENING" | "UNCHANGED" | "WEAKENING" | "INSUFFICIENT_DATA";

const STATUS_RANK: Record<CriterionStatus, number> = { RED: 0, WATCH: 1, GREEN: 2, INSUFFICIENT_DATA: -1 };

export interface CriterionStatusChange {
  previousStatus: CriterionStatus | null;
  currentStatus: CriterionStatus;
}

/**
 * "Thesis strengthening / unchanged / weakening / insufficient data" — the
 * scorecard's headline signal. Deliberately not a buy/hold/sell
 * instruction: it only reports the *direction* of change in how many
 * criteria improved vs. worsened since the last evaluation, never a
 * recommendation. Criteria with no prior evaluation, or where either side
 * is INSUFFICIENT_DATA, are excluded from the comparison rather than
 * counted as unchanged — an unanswered criterion isn't evidence of
 * stability.
 */
export function computeThesisTrend(criteria: CriterionStatusChange[]): ThesisTrend {
  const comparable = criteria.filter(
    (c) =>
      c.previousStatus !== null &&
      c.previousStatus !== "INSUFFICIENT_DATA" &&
      c.currentStatus !== "INSUFFICIENT_DATA",
  );

  if (comparable.length === 0) return "INSUFFICIENT_DATA";

  let improved = 0;
  let worsened = 0;

  for (const c of comparable) {
    const delta = STATUS_RANK[c.currentStatus] - STATUS_RANK[c.previousStatus as CriterionStatus];
    if (delta > 0) improved++;
    else if (delta < 0) worsened++;
  }

  if (improved > worsened) return "STRENGTHENING";
  if (worsened > improved) return "WEAKENING";
  return "UNCHANGED";
}
