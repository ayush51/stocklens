import { z } from "zod";

import { stripMarkdownFences } from "@/features/ai-summaries/lib/strip-json-fences";

/**
 * Exactly the five relevance labels instructions.md §10 specifies —
 * deliberately not "bullish"/"bearish" or any predicted-price-direction
 * framing, since that's a claim this pipeline (headline + summary only,
 * no full article text) has no real basis for.
 */
export const NEWS_RELEVANCE_LABELS = [
  "POTENTIALLY_MATERIAL",
  "WORTH_MONITORING",
  "LOW_RELEVANCE",
  "DUPLICATE_OR_KNOWN",
  "INSUFFICIENT_INFORMATION",
] as const;

export const newsImpactSchema = z.object({
  relevance: z.enum(NEWS_RELEVANCE_LABELS),
  reasoning: z.string().min(1),
  /** Null when the headline/summary alone don't give enough to judge novelty either way. */
  isLikelyNewInformation: z.boolean().nullable(),
});

export type NewsImpactContent = z.infer<typeof newsImpactSchema>;

export function parseNewsImpactContent(raw: string): NewsImpactContent | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw));
    const result = newsImpactSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
