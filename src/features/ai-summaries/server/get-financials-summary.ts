import { createHash } from "node:crypto";

import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";
import {
  parseFilingSummaryContent,
  type FilingSummaryContent,
} from "@/features/ai-summaries/lib/filing-summary-schema";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";

const PROMPT_VERSION = "financials-summary-v1";
const STATEMENTS_CONSIDERED = 8;

export interface FinancialsSummaryResult {
  summary: FilingSummaryContent;
  model: string;
  cached: boolean;
}

function toStatementText(statement: {
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
 * Global reference data, same reasoning as getOrGenerateFilingSummary: a
 * summary of a company's reported financials is objectively about that
 * company's public filings, not workspace-specific, so it's generated once
 * and cached for every workspace. Keyed by companyId (not a single
 * FinancialStatement row) since it covers the last several periods.
 *
 * Cache key includes the actual statement figures, so a newly reported
 * period (which changes the input) naturally invalidates the cache without
 * any explicit staleness tracking.
 */
export async function getOrGenerateFinancialsSummary(
  companyId: string,
): Promise<FinancialsSummaryResult | null> {
  const statements = await prismaService.financialStatement.findMany({
    where: { companyId },
    orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
    take: STATEMENTS_CONSIDERED,
  });
  if (statements.length === 0) return null;

  const plainText = statements.map(toStatementText).join("\n");
  const inputHash = createHash("sha256").update(plainText).update(PROMPT_VERSION).digest("hex");

  // See get-filing-summary.ts for why this is findFirst + explicit
  // create/update rather than the compound-unique upsert shorthand — same
  // NULL-in-a-unique-constraint limitation applies here.
  const cacheFilter = {
    subjectType: "COMPANY_FINANCIALS" as const,
    secFilingId: null,
    earningsEventId: null,
    thesisId: null,
    companyId,
    inputHash,
  };

  const existing = await prismaService.aISummary.findFirst({ where: cacheFilter });

  if (existing) {
    const parsed = parseFilingSummaryContent(existing.content);
    if (parsed) return { summary: parsed, model: existing.model, cached: true };
  }

  const provider = getAISummaryProvider();
  const result = await provider.summarize({
    subjectType: "COMPANY_FINANCIALS",
    content: plainText,
    promptVersion: PROMPT_VERSION,
  });

  const parsed = parseFilingSummaryContent(result.content);
  if (!parsed) {
    throw new AppError("INTERNAL_ERROR", "AI summary generation returned an unexpected format.");
  }

  if (existing) {
    await prismaService.aISummary.update({
      where: { id: existing.id },
      data: { content: result.content, model: result.model },
    });
  } else {
    await prismaService.aISummary.create({
      data: {
        subjectType: "COMPANY_FINANCIALS",
        companyId,
        inputHash,
        model: result.model,
        promptVersion: PROMPT_VERSION,
        content: result.content,
        workspaceId: null,
      },
    });
  }

  return { summary: parsed, model: result.model, cached: false };
}
