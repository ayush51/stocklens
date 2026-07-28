import { z } from "zod";

export const FISCAL_PERIODS = ["Q1", "Q2", "Q3", "Q4", "FY"] as const;

export const recordObservationSchema = z.object({
  templateItemId: z.uuid(),
  ticker: z.string().min(1),
  // Not z.coerce.number(): the form already produces a real number via
  // register(..., { valueAsNumber: true }) — coercing here too creates an
  // input/output type mismatch that zodResolver can't reconcile cleanly.
  fiscalYear: z.number().int().min(2000, "Enter a real year").max(2100, "Enter a real year"),
  fiscalPeriod: z.enum(FISCAL_PERIODS),
  value: z.string().trim().min(1, "Value is required").max(500),
  source: z.string().trim().max(500).optional().or(z.literal("")),
});

export type RecordObservationInput = z.infer<typeof recordObservationSchema>;
