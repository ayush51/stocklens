import { z } from "zod";

export const earningsReviewSchema = z.object({
  earningsEventId: z.string().uuid(),
  companyId: z.string().uuid(),
  ticker: z.string(), // for revalidatePath only, not persisted
  notes: z.string().trim().min(1, "Add a note before saving").max(4000),
  affectsThesis: z.boolean(),
});

export type EarningsReviewInput = z.infer<typeof earningsReviewSchema>;
