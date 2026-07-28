import { z } from "zod";

// Matches the Prisma TransactionType enum exactly (BUY/SELL/DIVIDEND/SPLIT).
// The richer type list in shared/contracts/brokerage-connector.ts
// (DIVIDEND_REINVESTMENT/DEPOSIT/WITHDRAWAL/FEE/INTEREST/TRANSFER_IN/
// TRANSFER_OUT) isn't accepted by any write path yet — those need a cash
// ledger this schema doesn't have, and are scoped into CSV import instead
// of guessed at here in isolation.
export const MANUAL_TRANSACTION_TYPES = ["BUY", "SELL", "DIVIDEND", "SPLIT"] as const;

const decimalString = (label: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, `${label} must be a positive number`)
    .refine((value) => Number(value) > 0, `${label} must be greater than zero`);

export const createTransactionSchema = z.object({
  portfolioId: z.uuid(),
  ticker: z
    .string()
    .trim()
    .min(1, "Ticker is required")
    .max(10, "Ticker looks too long")
    .transform((value) => value.toUpperCase()),
  type: z.enum(MANUAL_TRANSACTION_TYPES),
  quantity: decimalString("Quantity"),
  price: decimalString("Price"),
  fees: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Fees must be a non-negative number")
    .optional()
    .or(z.literal("")),
  occurredAt: z.iso.date("Enter a valid date"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
