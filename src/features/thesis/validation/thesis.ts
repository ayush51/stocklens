import { z } from "zod";

export const CONVICTION_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const THESIS_STATUSES = ["UNREVIEWED", "ON_TRACK", "WATCH", "WEAKENED", "BROKEN", "EXITED"] as const;

const optionalText = z.string().trim().optional().or(z.literal(""));

export const thesisFormSchema = z.object({
  companyId: z.uuid(),
  ticker: z.string().min(1),
  title: z.string().trim().min(1, "Title is required").max(200),
  summary: z.string().trim().min(1, "Summary is required"),
  whyMispriced: optionalText,
  expectedDrivers: optionalText,
  risks: optionalText,
  keyAssumptions: optionalText,
  timeHorizon: z.string().trim().max(100).optional().or(z.literal("")),
  valuationNotes: optionalText,
  positionSizingRationale: optionalText,
  reasonsToAdd: optionalText,
  reasonsToHold: optionalText,
  reasonsToTrim: optionalText,
  reasonsToExit: optionalText,
  invalidationConditions: optionalText,
  nextReviewDate: z.iso.date().optional().or(z.literal("")),
  // No .default([]) — the form always supplies an explicit `sources` array
  // via defaultValues, and a schema-level default here creates an
  // input/output type mismatch zodResolver can't reconcile (same issue as
  // z.coerce.number() elsewhere in this app — see company-metrics'
  // validation/observation.ts).
  sources: z.array(z.string().trim().min(1)),
  conviction: z.enum(CONVICTION_LEVELS),
  targetPrice: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a positive number")
    .optional()
    .or(z.literal("")),
  status: z.enum(THESIS_STATUSES),
});

export type ThesisFormInput = z.infer<typeof thesisFormSchema>;

/** Fields that participate in version-to-version diffing — see lib/diff-thesis.ts. Kept separate from targetPrice/conviction/status, which aren't free text. */
export const THESIS_TEXT_FIELDS = [
  { key: "title", label: "Title" },
  { key: "summary", label: "Summary" },
  { key: "whyMispriced", label: "Why the market may be mispricing it" },
  { key: "expectedDrivers", label: "Expected business drivers" },
  { key: "risks", label: "Risks" },
  { key: "keyAssumptions", label: "Key assumptions" },
  { key: "timeHorizon", label: "Time horizon" },
  { key: "valuationNotes", label: "Valuation notes" },
  { key: "positionSizingRationale", label: "Position-sizing rationale" },
  { key: "reasonsToAdd", label: "Reasons to add" },
  { key: "reasonsToHold", label: "Reasons to hold" },
  { key: "reasonsToTrim", label: "Reasons to trim" },
  { key: "reasonsToExit", label: "Reasons to exit" },
  { key: "invalidationConditions", label: "Invalidation conditions" },
] as const;
