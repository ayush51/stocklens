/**
 * Congressional trade-disclosure data boundary. Per this feature's own
 * spec: House/Senate disclosure sites have no stable, developer-friendly
 * API, and automated retrieval must not bypass access controls, rate
 * limits, or terms of service. Phase 1/2 of this feature therefore ships
 * ManualCongressImportProvider (CSV/JSON import) and a sample-fixture
 * provider for development — never a scraper.
 *
 * Adapter point for later: an OfficialHouseDisclosureProvider,
 * OfficialSenateDisclosureProvider, or AuthorizedThirdPartyCongressProvider
 * would implement this exact same interface once a permitted retrieval
 * method is confirmed (an official bulk-data feed, or a licensed
 * third-party API) — no other part of this feature would need to change.
 */

export type CongressChamber = "HOUSE" | "SENATE";
export type CongressOwner = "SELF" | "SPOUSE" | "DEPENDENT" | "JOINT" | "UNKNOWN";
export type CongressTransactionType = "PURCHASE" | "SALE" | "EXCHANGE" | "UNKNOWN";

export interface CongressionalTransactionRecord {
  politicianName: string;
  chamber: CongressChamber;
  state: string | null;
  party: string | null;
  owner: CongressOwner;
  assetNameDisclosed: string;
  transactionType: CongressTransactionType;
  transactionDate: string; // YYYY-MM-DD
  filingDate: string; // YYYY-MM-DD
  reportedRangeMin: string | null;
  reportedRangeMax: string | null;
  filingUrl: string | null;
  /** Stable id from the source file/feed — the dedup key. */
  externalId: string;
}

export interface CongressionalTransactionsProvider {
  /** A short, stable identifier for where this data actually came from — shown in the UI, never hidden. */
  readonly sourceName: string;
  /** False for manual imports and sample fixtures — the UI must never present those as live official data. */
  readonly isLiveOfficialSource: boolean;
  listRecentTransactions(opts?: { since?: Date; limit?: number }): Promise<CongressionalTransactionRecord[]>;
}
