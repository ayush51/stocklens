import { getFinancialStatementsForCompany } from "@/features/financial-metrics/server/queries";
import { getRatiosAndRecommendationsForCompany } from "@/features/company-ratios/server/queries";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import {
  computeGrowthTrend,
  computeMarginTrend,
  type TrendResult,
  type GrowthTrendState,
  type MarginTrendState,
} from "@/features/company-analysis/lib/growth-trend";
import {
  computeValuationPosition,
  type ValuationPositionResult,
} from "@/features/company-analysis/lib/valuation-position";

export interface CompanyAnalysisSnapshot {
  growthTrend: TrendResult<GrowthTrendState>;
  marginTrend: TrendResult<MarginTrendState>;
  valuationPosition: ValuationPositionResult | null;
}

/**
 * All three states are deterministic (instructions.md §11) — computed from
 * FinancialStatement history and live ratios/quote already fetched
 * elsewhere in the app, not from AI. See growth-trend.ts and
 * valuation-position.ts for the exact formulas and honesty caveats on
 * each state.
 */
export async function getCompanyAnalysisSnapshot(
  companyId: string,
  cik: string | null,
  ticker: string,
): Promise<CompanyAnalysisSnapshot> {
  const [statements, { ratios }, quote] = await Promise.all([
    getFinancialStatementsForCompany(companyId, cik),
    getRatiosAndRecommendationsForCompany(ticker),
    getMarketDataProvider().getQuote(ticker),
  ]);

  const growthTrend = computeGrowthTrend(statements);
  const marginTrend = computeMarginTrend(statements);
  const valuationPosition = ratios
    ? computeValuationPosition(quote?.price ?? null, ratios.week52High, ratios.week52Low, ratios.asOf)
    : null;

  return { growthTrend, marginTrend, valuationPosition };
}
