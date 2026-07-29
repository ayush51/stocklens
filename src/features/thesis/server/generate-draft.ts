import { getFinancialStatementsForCompany } from "@/features/financial-metrics/server/queries";
import { getRatiosAndRecommendationsForCompany } from "@/features/company-ratios/server/queries";
import { getCachedFinancialsSummary } from "@/features/ai-summaries/server/queries";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";
import { parseThesisDraftContent, type ThesisDraftContent } from "@/features/thesis/lib/thesis-draft-schema";
import { AppError } from "@/lib/errors";

const PROMPT_VERSION = "thesis-draft-v1";

function statementText(statement: {
  fiscalYear: number;
  fiscalPeriod: string;
  revenue: unknown;
  netIncome: unknown;
  grossProfit: unknown;
  eps: unknown;
  totalAssets: unknown;
  totalLiabilities: unknown;
}): string {
  const period =
    statement.fiscalPeriod === "FY"
      ? `FY${statement.fiscalYear}`
      : `${statement.fiscalPeriod} ${statement.fiscalYear}`;
  const fmt = (value: unknown) => (value === null || value === undefined ? "not reported" : String(value));
  return `${period}: revenue=${fmt(statement.revenue)}, netIncome=${fmt(statement.netIncome)}, grossProfit=${fmt(statement.grossProfit)}, eps=${fmt(statement.eps)}, totalAssets=${fmt(statement.totalAssets)}, totalLiabilities=${fmt(statement.totalLiabilities)}`;
}

/**
 * Not cached (unlike filing/financials summaries): a thesis draft is a
 * one-off starting point for one editing session, not a document that
 * benefits from being served identically to every workspace forever —
 * each draft attempt is a fresh, user-triggered spend.
 *
 * Never writes anything — purely generates text for the caller (the
 * thesis creation form) to show as an editable, clearly-labeled draft. See
 * thesis/server/actions.ts#saveThesis for the actual (unrelated, always
 * explicit) save path.
 */
export async function generateThesisDraft(
  companyId: string,
  cik: string | null,
  ticker: string,
  companyName: string,
): Promise<ThesisDraftContent> {
  const [statements, { ratios }, cachedSummary] = await Promise.all([
    getFinancialStatementsForCompany(companyId, cik),
    getRatiosAndRecommendationsForCompany(ticker),
    getCachedFinancialsSummary(companyId),
  ]);

  const parts: string[] = [];
  if (statements.length > 0) {
    parts.push(
      `Recent reported financial statements:\n${statements.slice(0, 8).map(statementText).join("\n")}`,
    );
  }
  if (ratios) {
    parts.push(
      `Valuation/quality ratios: P/E trailing=${ratios.peRatioTrailing ?? "not reported"}, P/E forward=${ratios.peRatioForward ?? "not reported"}, price-to-book=${ratios.priceToBook ?? "not reported"}, beta=${ratios.beta ?? "not reported"}, dividend yield=${ratios.dividendYieldTtm ?? "not reported"}, 52-week range=${ratios.week52Low ?? "?"}-${ratios.week52High ?? "?"}.`,
    );
  }
  if (cachedSummary) {
    parts.push(
      `Existing AI-generated summary of this company's financials:\n${cachedSummary.summary.plainEnglishSummary}`,
    );
  }

  if (parts.length === 0) {
    throw new AppError(
      "NOT_FOUND",
      "No financial data available yet for this company — visit its Financials tab first so there's something real to draft from.",
    );
  }

  const provider = getAISummaryProvider();
  const result = await provider.draftThesis({
    ticker,
    companyName,
    content: parts.join("\n\n"),
    promptVersion: PROMPT_VERSION,
  });

  const parsed = parseThesisDraftContent(result.content);
  if (!parsed) {
    throw new AppError("INTERNAL_ERROR", "AI thesis draft generation returned an unexpected format.");
  }
  return parsed;
}
