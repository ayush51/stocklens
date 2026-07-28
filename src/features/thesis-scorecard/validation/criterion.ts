import { z } from "zod";

export const CRITERION_DIRECTIONS = ["HIGHER_IS_BETTER", "LOWER_IS_BETTER"] as const;
export const CRITERION_RULE_TYPES = [
  "NUMERIC_THRESHOLD",
  "PERCENT_GROWTH_THRESHOLD",
  "SEQUENTIAL_CHANGE",
  "YEAR_OVER_YEAR_CHANGE",
  "CONSECUTIVE_DETERIORATION",
  "BOOLEAN_EVENT",
  "QUALITATIVE_MANUAL",
] as const;
export const CRITERION_STATUSES = ["GREEN", "WATCH", "RED", "INSUFFICIENT_DATA"] as const;
export const FISCAL_PERIODS = ["Q1", "Q2", "Q3", "Q4", "FY"] as const;

const optionalNumeric = z
  .string()
  .trim()
  .regex(/^-?\d+(\.\d+)?$/, "Enter a number")
  .optional()
  .or(z.literal(""));

export const criterionFormSchema = z.object({
  thesisId: z.uuid(),
  ticker: z.string().min(1),
  metricLabel: z.string().trim().min(1, "Label is required").max(200),
  direction: z.enum(CRITERION_DIRECTIONS),
  ruleType: z.enum(CRITERION_RULE_TYPES),
  greenRule: z.string().trim().min(1, "Describe the green rule"),
  watchRule: z.string().trim().min(1, "Describe the watch rule"),
  redRule: z.string().trim().min(1, "Describe the red rule"),
  greenThreshold: optionalNumeric,
  watchThreshold: optionalNumeric,
  evaluationPeriod: z.string().trim().min(1, "Required").max(50),
  consecutivePeriodRequirement: z.number().int().min(1).max(12),
});

export type CriterionFormInput = z.infer<typeof criterionFormSchema>;

const optionalText = z.string().trim().optional().or(z.literal(""));

export const evaluationFormSchema = z.object({
  criterionId: z.uuid(),
  ticker: z.string().min(1),
  fiscalYear: z.number().int().min(2000, "Enter a real year").max(2100, "Enter a real year"),
  fiscalPeriod: z.enum(FISCAL_PERIODS),
  currentValue: optionalText,
  previousValue: optionalText,
  status: z.enum(CRITERION_STATUSES),
  explanation: optionalText,
  source: optionalText,
  overrideReason: optionalText,
});

export type EvaluationFormInput = z.infer<typeof evaluationFormSchema>;
