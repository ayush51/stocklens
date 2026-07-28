import { z } from "zod";

export const DECISION_ACTIONS = ["BUY", "ADD", "HOLD", "TRIM", "EXIT", "WATCH"] as const;
export const DECISION_EMOTIONS = [
  "CONFIDENT",
  "ANXIOUS",
  "FOMO",
  "REGRET",
  "NEUTRAL",
  "EXCITED",
  "FEARFUL",
] as const;
export const CONFIDENCE_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

/** Actions that trigger the pre-add behavioral checklist. */
export const ADD_LIKE_ACTIONS = new Set<(typeof DECISION_ACTIONS)[number]>(["BUY", "ADD"]);

const optionalText = z.string().trim().optional().or(z.literal(""));

export const decisionEntrySchema = z.object({
  ticker: z.string().trim().min(1, "Ticker is required"),
  decisionDate: z.iso.date("Enter a valid date"),
  action: z.enum(DECISION_ACTIONS),
  proposedAmount: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
    .optional()
    .or(z.literal("")),
  evidenceSupporting: optionalText,
  evidenceOpposing: optionalText,
  currentEmotion: z.enum(DECISION_EMOTIONS).optional(),
  confidence: z.enum(CONFIDENCE_LEVELS).optional(),
  thesisImpact: optionalText,
  positionSizeImpact: optionalText,
  taxConsiderationNotes: optionalText,
  whatWouldChangeDecision: optionalText,
  // Pre-add checklist — only meaningfully filled when action is BUY/ADD,
  // but always present in the form shape so the schema doesn't need a
  // discriminated union just for this.
  wouldBuyIfOwnedNone: z.boolean().optional(),
  buyingBecauseThesisImprovedNotPriceDrop: z.boolean().optional(),
  belowAllocationCeiling: z.boolean().optional(),
  portfolioAdequatelyDiversified: z.boolean().optional(),
  newEvidenceForPurchase: optionalText,
  evidenceThatWouldProveWrong: optionalText,
  reviewDate: z.iso.date().optional().or(z.literal("")),
});

export type DecisionEntryInput = z.infer<typeof decisionEntrySchema>;
