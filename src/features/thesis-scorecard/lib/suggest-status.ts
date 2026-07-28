export type CriterionDirection = "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";

export type CriterionRuleType =
  | "NUMERIC_THRESHOLD"
  | "PERCENT_GROWTH_THRESHOLD"
  | "SEQUENTIAL_CHANGE"
  | "YEAR_OVER_YEAR_CHANGE"
  | "CONSECUTIVE_DETERIORATION"
  | "BOOLEAN_EVENT"
  | "QUALITATIVE_MANUAL";

export type CriterionStatus = "GREEN" | "WATCH" | "RED" | "INSUFFICIENT_DATA";

interface ThresholdInputs {
  direction: CriterionDirection;
  greenThreshold: number | null;
  watchThreshold: number | null;
}

/**
 * greenThreshold/watchThreshold are boundaries, not a three-way band: with
 * HIGHER_IS_BETTER, meeting-or-beating greenThreshold is GREEN, otherwise
 * meeting-or-beating watchThreshold is WATCH, otherwise RED. Direction
 * flips both comparisons for LOWER_IS_BETTER metrics (e.g. net debt).
 */
function compareAgainstThresholds(
  value: number,
  { direction, greenThreshold, watchThreshold }: ThresholdInputs,
): CriterionStatus {
  if (greenThreshold === null || watchThreshold === null) return "INSUFFICIENT_DATA";

  const meetsGreen = direction === "HIGHER_IS_BETTER" ? value >= greenThreshold : value <= greenThreshold;
  if (meetsGreen) return "GREEN";

  const meetsWatch = direction === "HIGHER_IS_BETTER" ? value >= watchThreshold : value <= watchThreshold;
  return meetsWatch ? "WATCH" : "RED";
}

export interface SuggestCriterionStatusInput {
  ruleType: CriterionRuleType;
  direction: CriterionDirection;
  greenThreshold: number | null;
  watchThreshold: number | null;
  currentValue: number | null;
  previousValue: number | null;
  /** Chronological, most recent last — only used by CONSECUTIVE_DETERIORATION. */
  history?: number[];
  consecutivePeriodRequirement?: number;
}

/**
 * A *suggestion* only — the person recording an evaluation always sees and
 * can override this (see ThesisEvaluation.isManualOverride). Never treat
 * this as an automatic buy/hold/sell instruction; it only classifies one
 * criterion's health, and the scorecard as a whole is explicitly barred
 * from collapsing into a trade instruction (see computeThesisTrend).
 *
 * BOOLEAN_EVENT and QUALITATIVE_MANUAL always return INSUFFICIENT_DATA —
 * there is no formula for "did a qualitative event happen," that's a human
 * judgment call by design, not a gap to fill in later.
 */
export function suggestCriterionStatus(input: SuggestCriterionStatusInput): CriterionStatus {
  const {
    ruleType,
    direction,
    greenThreshold,
    watchThreshold,
    currentValue,
    previousValue,
    history,
    consecutivePeriodRequirement,
  } = input;

  switch (ruleType) {
    case "NUMERIC_THRESHOLD": {
      if (currentValue === null) return "INSUFFICIENT_DATA";
      return compareAgainstThresholds(currentValue, { direction, greenThreshold, watchThreshold });
    }

    case "PERCENT_GROWTH_THRESHOLD":
    case "SEQUENTIAL_CHANGE":
    case "YEAR_OVER_YEAR_CHANGE": {
      if (currentValue === null || previousValue === null || previousValue === 0) return "INSUFFICIENT_DATA";
      const growthPct = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
      return compareAgainstThresholds(growthPct, { direction, greenThreshold, watchThreshold });
    }

    case "CONSECUTIVE_DETERIORATION": {
      const required = consecutivePeriodRequirement ?? 1;
      if (!history || history.length < required + 1) return "INSUFFICIENT_DATA";

      const recent = history.slice(-(required + 1));
      let consecutiveDeclines = 0;
      for (let i = 1; i < recent.length; i++) {
        const declined =
          direction === "HIGHER_IS_BETTER" ? recent[i] < recent[i - 1] : recent[i] > recent[i - 1];
        if (declined) consecutiveDeclines++;
      }

      if (consecutiveDeclines >= required) return "RED";
      if (consecutiveDeclines > 0) return "WATCH";
      return "GREEN";
    }

    case "BOOLEAN_EVENT":
    case "QUALITATIVE_MANUAL":
      return "INSUFFICIENT_DATA";
  }
}
