import { z } from "zod";

import { stripMarkdownFences } from "@/features/ai-summaries/lib/strip-json-fences";

/**
 * The structured shape every AISummaryProvider's `extractMetrics().content`
 * must be a JSON-encoding of: one entry per requested metric key, `found`
 * distinguishing "not discussed in this filing" from a real zero, and
 * `supportingQuote` giving the model somewhere to ground the extraction
 * (reduces fabrication risk — an unfindable quote is a strong signal the
 * value itself is invented) even though it isn't persisted to the DB.
 */
export const kpiExtractionSchema = z.object({
  metrics: z.array(
    z.object({
      key: z.string().min(1),
      found: z.boolean(),
      value: z.string().nullable(),
      supportingQuote: z.string().nullable(),
    }),
  ),
});

export type KpiExtractionContent = z.infer<typeof kpiExtractionSchema>;

export function parseKpiExtractionContent(raw: string): KpiExtractionContent | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw));
    const result = kpiExtractionSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
