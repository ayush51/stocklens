/**
 * Client-safe mirror of the Prisma TransactionType enum — kept as a plain
 * const array (not imported from the generated Prisma client) so this
 * feature's client components never pull server-only/Prisma code into the
 * browser bundle, matching the normalizeTicker split in features/companies.
 */
export const ALL_TRANSACTION_TYPES = [
  "BUY",
  "SELL",
  "DIVIDEND",
  "DIVIDEND_REINVESTMENT",
  "DEPOSIT",
  "WITHDRAWAL",
  "FEE",
  "INTEREST",
  "SPLIT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
] as const;

export type TransactionTypeValue = (typeof ALL_TRANSACTION_TYPES)[number];

export const CASH_ONLY_TYPES = new Set<TransactionTypeValue>(["DEPOSIT", "WITHDRAWAL", "FEE", "INTEREST"]);
export const SHARE_AND_PRICE_REQUIRED_TYPES = new Set<TransactionTypeValue>([
  "BUY",
  "SELL",
  "DIVIDEND_REINVESTMENT",
  "TRANSFER_IN",
  "TRANSFER_OUT",
]);
