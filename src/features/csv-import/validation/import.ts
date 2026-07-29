import { z } from "zod";

import { ALL_TRANSACTION_TYPES } from "@/features/csv-import/lib/transaction-types";

const numericString = z.string().regex(/^-?\d+(\.\d+)?$/);

export const normalizedRowSchema = z.object({
  rowNumber: z.number().int().positive(),
  occurredAt: z.iso.date(),
  ticker: z.string().trim().min(1).max(10).nullable(),
  type: z.enum(ALL_TRANSACTION_TYPES),
  quantity: numericString.nullable(),
  price: numericString.nullable(),
  amount: numericString.nullable(),
  fees: numericString.nullable(),
  externalId: z.string().min(1).max(64),
});

export const confirmImportSchema = z.object({
  portfolioId: z.uuid(),
  filename: z.string().trim().min(1).max(255),
  checksum: z.string().regex(/^[0-9a-f]{64}$/, "Invalid checksum"),
  columnMapping: z.record(z.string(), z.union([z.number(), z.null()])),
  // Capped — this is a web request body, not a batch-ingestion pipeline;
  // very large files should be split, not pushed through a single request.
  rows: z
    .array(normalizedRowSchema)
    .min(1, "No rows to import")
    .max(5000, "Too many rows in a single import"),
});

export type ConfirmImportInput = z.infer<typeof confirmImportSchema>;
