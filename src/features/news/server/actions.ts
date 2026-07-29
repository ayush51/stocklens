"use server";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";
import { parseNewsImpactContent, type NewsImpactContent } from "@/features/news/lib/news-impact-schema";

const PROMPT_VERSION = "news-impact-v1";

/**
 * User-triggered only — costs real money against a real API key. Not
 * cached: news items aren't persisted anywhere (no NewsItem/Article table
 * — see news/server/queries.ts), so there's no stable id to cache against.
 * Re-classifying on demand is cheap (one short headline/summary), so this
 * isn't worth a schema change to add caching for.
 */
export async function classifyNewsImpact(
  companyId: string,
  headline: string,
  summary: string,
  ticker: string,
  companyName: string,
): Promise<NewsImpactContent> {
  const authUser = await requireUser();
  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const prisma = forUser(authUser.id);

  const thesis = await prisma.thesis.findFirst({
    where: { workspaceId, companyId },
    select: { summary: true },
  });

  const provider = getAISummaryProvider();
  const result = await provider.classifyNewsImpact({
    ticker,
    companyName,
    headline,
    summary,
    thesisContext: thesis?.summary ?? null,
    promptVersion: PROMPT_VERSION,
  });

  const parsed = parseNewsImpactContent(result.content);
  if (!parsed) {
    throw new AppError("INTERNAL_ERROR", "AI news classification returned an unexpected format.");
  }
  return parsed;
}
