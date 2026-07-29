import { prisma } from "@/lib/db/prisma";
import {
  parseFilingSummaryContent,
  type FilingSummaryContent,
} from "@/features/ai-summaries/lib/filing-summary-schema";

/** Read-only cache check — never triggers generation. Global reference data, open SELECT policy, no user claim needed. */
export async function getCachedFilingSummaries(
  filingIds: string[],
): Promise<Map<string, { summary: FilingSummaryContent; model: string }>> {
  if (filingIds.length === 0) return new Map();

  const rows = await prisma.aISummary.findMany({
    where: { subjectType: "SEC_FILING", secFilingId: { in: filingIds } },
    orderBy: { createdAt: "desc" },
  });

  const result = new Map<string, { summary: FilingSummaryContent; model: string }>();
  for (const row of rows) {
    if (!row.secFilingId || result.has(row.secFilingId)) continue; // keep the newest per filing
    const parsed = parseFilingSummaryContent(row.content);
    if (parsed) result.set(row.secFilingId, { summary: parsed, model: row.model });
  }
  return result;
}

/** Same read-only cache-check reasoning as getCachedFilingSummaries, keyed by companyId instead. */
export async function getCachedFinancialsSummary(
  companyId: string,
): Promise<{ summary: FilingSummaryContent; model: string } | null> {
  const row = await prisma.aISummary.findFirst({
    where: { subjectType: "COMPANY_FINANCIALS", companyId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  const parsed = parseFilingSummaryContent(row.content);
  return parsed ? { summary: parsed, model: row.model } : null;
}
