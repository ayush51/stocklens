import { createHash } from "node:crypto";

import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";
import { secEdgarFilingsProvider } from "@/features/filings/providers/sec-edgar";
import { stripHtmlToText } from "@/features/ai-summaries/lib/strip-html";
import {
  parseFilingSummaryContent,
  type FilingSummaryContent,
} from "@/features/ai-summaries/lib/filing-summary-schema";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";

const PROMPT_VERSION = "filing-summary-v1";

// Bounds the prompt sent to the model — a handful of very large 10-Ks could
// still run to several hundred KB even as stripped plain text.
const MAX_CONTENT_CHARS = 400_000;

export interface FilingSummaryResult {
  summary: FilingSummaryContent;
  model: string;
  cached: boolean;
}

/**
 * Global reference data — a filing's summary is objectively about the
 * document, generated once and cached for every workspace forever after
 * (see the ai_summary_global_filings migration), same as
 * FinancialStatement. Always written via prismaService, never forUser().
 *
 * Cache key: sha256(stripped filing text + prompt version). If the same
 * filing is summarized again with the same prompt version, this returns
 * the cached row instead of calling the model again — filings never
 * change once published, so there is no freshness reason to regenerate.
 */
export async function getOrGenerateFilingSummary(filingId: string): Promise<FilingSummaryResult | null> {
  const filing = await prismaService.secFiling.findUnique({ where: { id: filingId } });
  if (!filing) return null;

  const rawHtml = await secEdgarFilingsProvider.getFilingDocumentText(filing.documentUrl);
  const plainText = stripHtmlToText(rawHtml).slice(0, MAX_CONTENT_CHARS);
  const inputHash = createHash("sha256").update(plainText).update(PROMPT_VERSION).digest("hex");

  // Not the compound-unique findUnique/upsert shorthand: Prisma's generated
  // type for it requires earningsEventId/thesisId to be a plain string, not
  // null, because Postgres unique constraints don't treat NULL as equal to
  // NULL — a compound-key lookup can't reliably express "match the row
  // where this column IS NULL." findFirst + explicit create/update on the
  // regular where-filter (which does accept null) works correctly instead.
  const cacheFilter = {
    subjectType: "SEC_FILING" as const,
    secFilingId: filingId,
    earningsEventId: null,
    thesisId: null,
    inputHash,
  };

  const existing = await prismaService.aISummary.findFirst({ where: cacheFilter });

  if (existing) {
    const parsed = parseFilingSummaryContent(existing.content);
    if (parsed) return { summary: parsed, model: existing.model, cached: true };
    // A cached row that doesn't parse shouldn't happen, but isn't trusted
    // blindly either — fall through and regenerate rather than serve garbage.
  }

  const provider = getAISummaryProvider();
  const result = await provider.summarize({
    subjectType: "SEC_FILING",
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
        subjectType: "SEC_FILING",
        secFilingId: filingId,
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
