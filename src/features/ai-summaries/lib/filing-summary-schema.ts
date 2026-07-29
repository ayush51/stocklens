import { z } from "zod";

/**
 * The structured shape every AISummaryProvider's `content` field must be a
 * JSON-encoding of, for SEC_FILING/EARNINGS_EVENT summaries. Parsed and
 * validated here rather than trusted — if the model's output doesn't match
 * this shape, that's treated as a failed generation (nothing is shown to
 * the user), never partially-rendered garbage.
 */
export const filingSummarySchema = z.object({
  plainEnglishSummary: z.string().min(1),
  keyFacts: z.array(z.string()),
  notableItems: z.array(z.string()),
  risksOrConcerns: z.array(z.string()),
  uncertainty: z.string().nullable(),
});

export type FilingSummaryContent = z.infer<typeof filingSummarySchema>;

/**
 * Models sometimes wrap JSON in markdown code fences despite being told
 * not to — stripped defensively before parsing rather than trusting the
 * instruction was followed exactly.
 */
function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}

export function parseFilingSummaryContent(raw: string): FilingSummaryContent | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw));
    const result = filingSummarySchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
