import { z } from "zod";

import { stripMarkdownFences } from "@/features/ai-summaries/lib/strip-json-fences";

/**
 * Deliberately narrower than the full thesis form: whyMispriced/
 * expectedDrivers/risks/keyAssumptions/summary are analytical framings a
 * draft can reasonably attempt from real financial data. reasonsToAdd/
 * Hold/Trim/Exit, targetPrice, and positionSizingRationale are excluded on
 * purpose — those are decision-framing fields where an AI draft edges
 * uncomfortably close to a directive, and instructions.md §8 is explicit
 * that "final status belongs to the user." The user fills those in
 * themselves after reading the draft.
 */
export const thesisDraftSchema = z.object({
  summary: z.string().min(1),
  whyMispriced: z.string().min(1),
  expectedDrivers: z.string().min(1),
  risks: z.string().min(1),
  keyAssumptions: z.string().min(1),
});

export type ThesisDraftContent = z.infer<typeof thesisDraftSchema>;

export function parseThesisDraftContent(raw: string): ThesisDraftContent | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw));
    const result = thesisDraftSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
