/**
 * SEC insider-transaction data boundary — implemented by
 * features/signal-convergence/providers/sec-insider. Scoped per-issuer
 * (by CIK), matching this app's existing per-company architecture
 * (financial-metrics, filings, earnings all work the same way) rather
 * than a market-wide crawl of every Form 3/4/5 filed anywhere.
 * See docs/phase-0/02-architecture.md §3.
 */

export type InsiderRelationshipCategory = "DIRECTOR" | "OFFICER" | "TEN_PERCENT_OWNER" | "OTHER";

export type InsiderTransactionClassification =
  | "OPEN_MARKET_PURCHASE"
  | "OPEN_MARKET_SALE"
  | "OPTION_EXERCISE"
  | "AWARD_OR_GRANT"
  | "GIFT"
  | "TAX_WITHHOLDING"
  | "AUTOMATIC_OR_PLANNED"
  | "OTHER";

export interface InsiderTransactionRecord {
  issuerCik: string;
  issuerName: string;
  reportingPersonName: string;
  reportingPersonTitle: string | null;
  relationshipCategory: InsiderRelationshipCategory;
  transactionDate: string; // YYYY-MM-DD
  filingDate: string;
  transactionCode: string; // raw Form 4 code — "P", "S", "A", "M", "G", "F", …
  classification: InsiderTransactionClassification;
  /** Null when the code isn't a clean acquire/dispose (e.g. some "other" codes). */
  isPurchase: boolean | null;
  shares: string | null;
  pricePerShare: string | null;
  estimatedTotalValue: string | null;
  ownershipType: string; // "D" direct / "I" indirect
  sharesOwnedAfter: string | null;
  is10b51Plan: boolean;
  isAmendment: boolean;
  accessionNumber: string;
  lineIndex: number;
  filingUrl: string;
}

export interface InsiderTransactionsProvider {
  /**
   * All Form 3/4/4-A/5/5-A transaction line items for one issuer, most
   * recent filings first. `since` bounds by filing date (not transaction
   * date) for incremental ingestion — a filing seen once is never
   * re-fetched unless it was actually filed after the last successful run.
   */
  listTransactionsForIssuer(
    cik: string,
    opts?: { since?: Date; limit?: number },
  ): Promise<InsiderTransactionRecord[]>;
}
