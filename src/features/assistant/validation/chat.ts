import { z } from "zod";

/**
 * Caps exist because this is a "use server" action taking arbitrary client
 * input that gets sent straight to a paid API — without limits, a client
 * could send an enormous message array/content and run up real API cost
 * per request.
 */
export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20),
});
