import { z } from "zod";

export const createPortfolioSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Keep it under 100 characters"),
});

export type CreatePortfolioInput = z.infer<typeof createPortfolioSchema>;
