/**
 * Provider-agnostic brokerage connector boundary. Every brokerage/import
 * source (Robinhood MCP, CSV, manual entry, and future SnapTrade/Plaid
 * adapters) implements this same interface so feature code never branches
 * on which provider it's talking to.
 *
 * `capabilities.trading` is typed as the literal `false` — not `boolean` —
 * so no implementation can ever compile with trading capability turned on.
 * There is deliberately no placeOrder/cancelOrder/exercise method anywhere
 * in this file. That is not an oversight to "add later"; it is the
 * security control itself. See docs/phase-0/09-security-model.md §3 and
 * ROBINHOOD_MCP_SECURITY_PLAN.md. Adding a write method here requires
 * re-approving that decision explicitly — it must never happen as a
 * drive-by addition alongside an unrelated feature.
 *
 * Supersedes the earlier, narrower brokerage-sync-provider.ts contract
 * (getAccountSummary/listPositions/listTransactions only) — nothing
 * implemented that one yet, so there's no migration to do, just this
 * richer shape instead.
 */

export type BrokerageProvider = "ROBINHOOD_MCP" | "CSV_IMPORT" | "MANUAL" | "SNAPTRADE" | "PLAID";

export interface ConnectBrokerageInput {
  provider: BrokerageProvider;
  workspaceId: string;
  /**
   * Provider-specific payload. For ROBINHOOD_MCP this is the already-
   * fetched position/account snapshot obtained via the read-only MCP tools
   * in a chat session — see RobinhoodMcpConnector. Never a credential: no
   * BrokerageConnector implementation accepts or stores one.
   */
  payload: unknown;
}

export interface ConnectionResult {
  connectionId: string;
  status: "CONNECTED" | "NEEDS_REAUTH" | "ERROR";
  connectedAt: string; // ISO 8601
}

export interface BrokerageAccount {
  externalId: string;
  displayName: string | null;
  accountType: string | null;
}

export interface AccountBalance {
  accountExternalId: string;
  cash: string; // decimal string
  currency: string;
  asOf: string; // ISO 8601
}

export interface BrokeragePosition {
  accountExternalId: string;
  ticker: string;
  quantity: string; // decimal string — parsed to Prisma Decimal at the write boundary
  averageCost: string | null;
  asOf: string; // ISO 8601
}

export interface BrokerageTransaction {
  externalId: string;
  accountExternalId: string;
  ticker: string | null; // null for pure-cash rows (deposit/withdrawal/interest/fee)
  type:
    | "BUY"
    | "SELL"
    | "DIVIDEND"
    | "DIVIDEND_REINVESTMENT"
    | "DEPOSIT"
    | "WITHDRAWAL"
    | "FEE"
    | "INTEREST"
    | "SPLIT"
    | "TRANSFER_IN"
    | "TRANSFER_OUT";
  quantity: string | null;
  price: string | null;
  amount: string | null; // cash amount, for rows without a quantity/price
  occurredAt: string; // ISO 8601
}

export interface TransactionSyncResult {
  transactions: BrokerageTransaction[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface TaxLot {
  externalId: string;
  accountExternalId: string;
  ticker: string;
  quantity: string;
  costPerShare: string;
  acquiredAt: string; // ISO 8601
}

export interface TaxLotSyncResult {
  taxLots: TaxLot[];
}

export interface ConnectorHealth {
  status: "OK" | "DEGRADED" | "DOWN";
  lastCheckedAt: string; // ISO 8601
  message: string | null;
}

export interface BrokerageConnectorCapabilities {
  accounts: boolean;
  balances: boolean;
  positions: boolean;
  transactions: boolean;
  taxLots: boolean;
  watchlists: boolean;
  trading: false;
}

export interface BrokerageConnector {
  readonly provider: BrokerageProvider;
  readonly capabilities: BrokerageConnectorCapabilities;

  connect(input: ConnectBrokerageInput): Promise<ConnectionResult>;
  disconnect(connectionId: string): Promise<void>;
  syncAccounts(connectionId: string): Promise<BrokerageAccount[]>;
  syncBalances(connectionId: string): Promise<AccountBalance[]>;
  syncPositions(connectionId: string): Promise<BrokeragePosition[]>;
  syncTransactions(connectionId: string, cursor?: string): Promise<TransactionSyncResult>;
  syncTaxLots(connectionId: string): Promise<TaxLotSyncResult>;
  healthCheck(connectionId: string): Promise<ConnectorHealth>;
}
