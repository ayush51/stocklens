export type GrowthTrendState = "ACCELERATING" | "STABLE" | "DECELERATING" | "INSUFFICIENT_DATA";
export type MarginTrendState = "IMPROVING" | "STABLE" | "DECLINING" | "INSUFFICIENT_DATA";

export interface StatementForTrend {
  fiscalYear: number;
  fiscalPeriod: string;
  revenue: unknown;
  grossProfit: unknown;
  fetchedAt: Date;
}

export interface TrendDataPoint {
  period: string;
  value: number;
}

export interface TrendResult<TState> {
  state: TState;
  formula: string;
  /** Chronological, oldest first — the last two entries are what determine the state. */
  dataPoints: TrendDataPoint[];
  comparisonPeriods: string | null;
  confidence: "REPORTED";
  sourceTimestamp: Date | null;
}

const QUARTER_ORDER: Record<string, number> = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Shared machinery for both trend functions below: builds a chronological
 * series of one YoY-quarterly figure per quarter (revenue growth % for
 * growth, gross-margin percentage-point change for margin), each compared
 * to the SAME quarter one year prior — not the prior quarter sequentially,
 * since sequential quarters can differ for purely seasonal reasons that
 * would otherwise read as a false trend. FY (annual) rows are excluded —
 * mixing annual and quarterly periods would compare figures on different
 * scales, not a real trend. Deterministic, no AI — matches instructions.md
 * §11 ("use deterministic code for... period comparison").
 */
function buildYoyQuarterlySeries(
  statements: StatementForTrend[],
  valueFor: (statement: StatementForTrend, priorYear: StatementForTrend) => number | null,
): (TrendDataPoint & { sortKey: number; sourceTimestamp: Date })[] {
  const quarters = statements.filter((s) => s.fiscalPeriod in QUARTER_ORDER);
  const byKey = new Map(quarters.map((s) => [`${s.fiscalYear}-${s.fiscalPeriod}`, s]));

  const dataPoints: (TrendDataPoint & { sortKey: number; sourceTimestamp: Date })[] = [];
  for (const statement of quarters) {
    const priorYear = byKey.get(`${statement.fiscalYear - 1}-${statement.fiscalPeriod}`);
    if (!priorYear) continue;

    const value = valueFor(statement, priorYear);
    if (value === null) continue;

    dataPoints.push({
      period: `${statement.fiscalPeriod} ${statement.fiscalYear}`,
      value: Math.round(value * 10) / 10,
      sortKey: statement.fiscalYear * 10 + QUARTER_ORDER[statement.fiscalPeriod],
      sourceTimestamp: statement.fetchedAt,
    });
  }

  dataPoints.sort((a, b) => a.sortKey - b.sortKey);
  return dataPoints;
}

/**
 * "Accelerating" / "decelerating" refers to the YoY revenue growth *rate*
 * itself speeding up or slowing down quarter to quarter — not whether
 * revenue is growing or shrinking.
 */
export function computeGrowthTrend(statements: StatementForTrend[]): TrendResult<GrowthTrendState> {
  const formula = "YoY revenue growth % for each quarter vs. the same quarter one year prior";
  const STABLE_BAND_PCT = 3;

  const dataPoints = buildYoyQuarterlySeries(statements, (statement, priorYear) => {
    const revenue = toNumber(statement.revenue);
    const priorRevenue = toNumber(priorYear.revenue);
    if (revenue === null || priorRevenue === null || priorRevenue <= 0) return null;
    return ((revenue - priorRevenue) / priorRevenue) * 100;
  });

  if (dataPoints.length < 2) {
    return {
      state: "INSUFFICIENT_DATA",
      formula,
      dataPoints,
      comparisonPeriods: null,
      confidence: "REPORTED",
      sourceTimestamp: dataPoints[0]?.sourceTimestamp ?? null,
    };
  }

  const latest = dataPoints[dataPoints.length - 1];
  const previous = dataPoints[dataPoints.length - 2];
  const delta = latest.value - previous.value;
  const state: GrowthTrendState =
    Math.abs(delta) < STABLE_BAND_PCT ? "STABLE" : delta > 0 ? "ACCELERATING" : "DECELERATING";

  return {
    state,
    formula,
    dataPoints,
    comparisonPeriods: `${previous.period} (${previous.value.toFixed(1)}% YoY) -> ${latest.period} (${latest.value.toFixed(1)}% YoY)`,
    confidence: "REPORTED",
    sourceTimestamp: latest.sourceTimestamp,
  };
}

/** "Improving" / "declining" refers to gross margin itself widening or narrowing, in percentage points, year over year. */
export function computeMarginTrend(statements: StatementForTrend[]): TrendResult<MarginTrendState> {
  const formula = "Gross margin percentage-point change for each quarter vs. the same quarter one year prior";
  const STABLE_BAND_PP = 1;

  const dataPoints = buildYoyQuarterlySeries(statements, (statement, priorYear) => {
    const revenue = toNumber(statement.revenue);
    const grossProfit = toNumber(statement.grossProfit);
    const priorRevenue = toNumber(priorYear.revenue);
    const priorGrossProfit = toNumber(priorYear.grossProfit);
    if (
      revenue === null ||
      revenue <= 0 ||
      grossProfit === null ||
      priorRevenue === null ||
      priorRevenue <= 0 ||
      priorGrossProfit === null
    ) {
      return null;
    }
    return (grossProfit / revenue) * 100 - (priorGrossProfit / priorRevenue) * 100;
  });

  if (dataPoints.length < 2) {
    return {
      state: "INSUFFICIENT_DATA",
      formula,
      dataPoints,
      comparisonPeriods: null,
      confidence: "REPORTED",
      sourceTimestamp: dataPoints[0]?.sourceTimestamp ?? null,
    };
  }

  const latest = dataPoints[dataPoints.length - 1];
  const previous = dataPoints[dataPoints.length - 2];
  const delta = latest.value - previous.value;
  const state: MarginTrendState =
    Math.abs(delta) < STABLE_BAND_PP ? "STABLE" : delta > 0 ? "IMPROVING" : "DECLINING";

  const sign = (n: number) => (n >= 0 ? "+" : "");
  return {
    state,
    formula,
    dataPoints,
    comparisonPeriods: `${previous.period} (${sign(previous.value)}${previous.value.toFixed(1)}pp YoY) -> ${latest.period} (${sign(latest.value)}${latest.value.toFixed(1)}pp YoY)`,
    confidence: "REPORTED",
    sourceTimestamp: latest.sourceTimestamp,
  };
}
