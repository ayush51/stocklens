import { z } from "zod";

import { stripMarkdownFences } from "@/features/ai-summaries/lib/strip-json-fences";

export const templateProposalSchema = z.object({
  metrics: z
    .array(
      z.object({
        keySlug: z
          .string()
          .min(1)
          .regex(/^[a-z][a-z0-9_]*$/, "must be lowercase snake_case"),
        label: z.string().min(1),
        description: z.string().min(1),
        unit: z.enum(["USD", "PERCENT", "COUNT", "TEXT"]),
        whyItMatters: z.string().min(1),
        reportedIn: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
});

export type TemplateProposalContent = z.infer<typeof templateProposalSchema>;

export function parseTemplateProposalContent(raw: string): TemplateProposalContent | null {
  try {
    const parsed = JSON.parse(stripMarkdownFences(raw));
    const result = templateProposalSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
