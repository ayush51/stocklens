/**
 * Read-only brokerage sync boundary.
 *
 * This interface intentionally has NO write methods — no placeOrder, no
 * cancelOrder, no exercise, nothing that could move money or submit a trade.
 * That is not an oversight to "add later"; it is the security control itself.
 * See docs/phase-0/09-security-model.md §3 and ROBINHOOD_MCP_SECURITY_PLAN.md.
 *
 * Adding a write method here requires re-approving that decision explicitly —
 * it must never happen as a drive-by addition alongside an unrelated feature.
 */

export interface BrokerageConnectionRef {
  connectionId: string;
  /** Opaque reference into the secret store — never the credential itself. */
  credentialRef: string;
}

export interface AccountSummary {
  accountId: string;
  displayName: string | null;
  status: "CONNECTED" | "NEEDS_REAUTH" | "ERROR";
}

export interface PositionSnapshot {
  externalId: string;
  ticker: string;
  quantity: string; // decimal string — parsed to Prisma Decimal at the write boundary
  averageCost: string;
}

export interface TransactionRecord {
  externalId: string;
  ticker: string;
  type: "BUY" | "SELL" | "DIVIDEND" | "SPLIT";
  quantity: string;
  price: string;
  occurredAt: string; // ISO 8601
}

export interface BrokerageSyncProvider {
  getAccountSummary(connection: BrokerageConnectionRef): Promise<AccountSummary>;
  listPositions(connection: BrokerageConnectionRef): Promise<PositionSnapshot[]>;
  listTransactions(connection: BrokerageConnectionRef, since?: Date): Promise<TransactionRecord[]>;
}
