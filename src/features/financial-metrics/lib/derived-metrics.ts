export interface DerivedMetricsInput {
  revenue: unknown;
  netIncome: unknown;
  operatingIncome: unknown;
  operatingCashFlow: unknown;
  capitalExpenditures: unknown;
}

export interface DerivedMetrics {
  operatingMarginPct: number | null;
  netMarginPct: number | null;
  freeCashFlow: number | null;
  fcfMarginPct: number | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Pure, deterministic — matches instructions.md §11 ("use deterministic
 * code for... ratios"). Every field is null (not 0) whenever an input is
 * missing or the denominator is non-positive, since these aren't
 * meaningful with a zero/negative revenue base.
 */
export function computeDerivedMetrics(input: DerivedMetricsInput): DerivedMetrics {
  const revenue = toNumber(input.revenue);
  const netIncome = toNumber(input.netIncome);
  const operatingIncome = toNumber(input.operatingIncome);
  const operatingCashFlow = toNumber(input.operatingCashFlow);
  const capitalExpenditures = toNumber(input.capitalExpenditures);

  const hasRevenue = revenue !== null && revenue > 0;

  const freeCashFlow =
    operatingCashFlow !== null && capitalExpenditures !== null
      ? operatingCashFlow - Math.abs(capitalExpenditures) // XBRL sometimes reports capex as a negative outflow, sometimes positive — normalize to a subtraction either way
      : null;

  return {
    operatingMarginPct: hasRevenue && operatingIncome !== null ? (operatingIncome / revenue) * 100 : null,
    netMarginPct: hasRevenue && netIncome !== null ? (netIncome / revenue) * 100 : null,
    freeCashFlow,
    fcfMarginPct: hasRevenue && freeCashFlow !== null ? (freeCashFlow / revenue) * 100 : null,
  };
}
