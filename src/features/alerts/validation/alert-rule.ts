import { z } from "zod";

/**
 * NEW_FILING is deliberately excluded from what users can create here:
 * "new since when" requires tracking a per-rule last-evaluated timestamp,
 * which AlertRule's schema doesn't have — evaluating it correctly would
 * mean adding that state, not just wiring up a UI. Left for a follow-up
 * rather than shipping a rule type whose semantics would be silently wrong.
 */
export const CREATABLE_ALERT_TYPES = [
  "PRICE_ABOVE",
  "PRICE_BELOW",
  "UPCOMING_EARNINGS",
  "THESIS_STALE",
] as const;

export const createAlertRuleSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PRICE_ABOVE"),
    companyId: z.uuid(),
    threshold: z.coerce.number().positive(),
  }),
  z.object({
    type: z.literal("PRICE_BELOW"),
    companyId: z.uuid(),
    threshold: z.coerce.number().positive(),
  }),
  z.object({
    type: z.literal("UPCOMING_EARNINGS"),
    companyId: z.uuid(),
    daysBefore: z.coerce.number().int().min(1).max(30),
  }),
  z.object({
    type: z.literal("THESIS_STALE"),
    thesisId: z.uuid(),
  }),
]);

export type CreateAlertRuleInput = z.infer<typeof createAlertRuleSchema>;
