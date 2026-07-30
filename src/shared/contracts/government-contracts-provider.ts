/**
 * Federal contract award data boundary — implemented by
 * features/signal-convergence/providers/usaspending. Scoped per-recipient
 * (by legal name, USAspending's own search key), matching this app's
 * existing per-company architecture.
 */

export type ContractRecordType = "NEW_AWARD" | "MODIFICATION" | "DE_OBLIGATION" | "CORRECTION";

export interface GovernmentContractEventRecord {
  externalId: string; // USAspending generated_internal_id (award-level, stable)
  modificationNumber: string | null;
  recipientLegalName: string;
  /**
   * Null when USAspending's search response doesn't include a resolvable
   * parent name for this award — not guessed. Entity resolution (a
   * separate layer) is what maps a recipient to a public company; this
   * provider only reports what USAspending itself returned.
   */
  parentRecipientName: string | null;
  awardingAgency: string;
  description: string | null;
  awardType: string;
  recordType: ContractRecordType;
  actionDate: string; // YYYY-MM-DD
  startDate: string | null;
  endDate: string | null;
  currentAwardAmount: string | null;
  newlyObligatedAmount: string | null;
  potentialAwardAmount: string | null;
  sourceUrl: string;
}

export interface GovernmentContractsProvider {
  /**
   * Recent contract actions (new awards and modifications) for one
   * recipient, most recent first. `since` bounds by action date for
   * incremental ingestion.
   */
  listRecentContractActionsForRecipient(
    recipientName: string,
    opts?: { since?: Date; limit?: number },
  ): Promise<GovernmentContractEventRecord[]>;
}
