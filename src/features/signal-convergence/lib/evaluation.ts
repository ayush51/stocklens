export interface ScoreBucketDef {
  label: string;
  minScore: number;
  maxScore: number;
}

/** Fixed score buckets — same boundaries the candidate table's badge coloring already uses (scoreVariant in candidate-table.tsx), so the evaluation view's buckets read consistently with the rest of the feature. */
export const SCORE_BUCKETS: ScoreBucketDef[] = [
  { label: "0-29", minScore: 0, maxScore: 29 },
  { label: "30-59", minScore: 30, maxScore: 59 },
  { label: "60-100", minScore: 60, maxScore: 100 },
];

export interface PriceBarLike {
  date: string; // YYYY-MM-DD
  close: string;
}

/** The most recent bar on or before `targetDate`, or null if none exists — never guesses a price for a date the provider didn't actually return. */
export function findClosestBarOnOrBefore(bars: PriceBarLike[], targetDate: string): PriceBarLike | null {
  let best: PriceBarLike | null = null;
  for (const bar of bars) {
    if (bar.date > targetDate) continue;
    if (!best || bar.date > best.date) best = bar;
  }
  return best;
}

export function computeForwardReturnPct(entryClose: number, exitClose: number): number {
  return ((exitClose - entryClose) / entryClose) * 100;
}

export interface EvaluableSample {
  totalScore: number;
  forwardReturnPct: number | null;
}

export interface SignalPerformanceBucket extends ScoreBucketDef {
  sampleCount: number;
  evaluableCount: number;
  averageForwardReturnPct: number | null;
}

/**
 * Buckets never report an average from too few samples — a 1-sample "average"
 * return is noise dressed up as a statistic, and this feature's whole premise
 * is not overstating what small amounts of real data actually show.
 */
export const MIN_SAMPLE_SIZE_FOR_AVERAGE = 3;

export function bucketSamples(samples: EvaluableSample[]): SignalPerformanceBucket[] {
  return SCORE_BUCKETS.map((def) => {
    const inBucket = samples.filter((s) => s.totalScore >= def.minScore && s.totalScore <= def.maxScore);
    const evaluable = inBucket.filter((s) => s.forwardReturnPct !== null) as {
      totalScore: number;
      forwardReturnPct: number;
    }[];
    const averageForwardReturnPct =
      evaluable.length >= MIN_SAMPLE_SIZE_FOR_AVERAGE
        ? evaluable.reduce((sum, s) => sum + s.forwardReturnPct, 0) / evaluable.length
        : null;
    return {
      ...def,
      sampleCount: inBucket.length,
      evaluableCount: evaluable.length,
      averageForwardReturnPct,
    };
  });
}
