import { forUser } from "@/lib/db/rls";
import type {
  AccountBalance,
  BrokerageAccount,
  BrokerageConnector,
  BrokeragePosition,
  ConnectionResult,
  ConnectorHealth,
  TaxLotSyncResult,
  TransactionSyncResult,
} from "@/shared/contracts/brokerage-connector";

interface ManualConnectPayload {
  userId: string;
  portfolioName: string;
}

function isManualPayload(payload: unknown): payload is ManualConnectPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as ManualConnectPayload).userId === "string" &&
    typeof (payload as ManualConnectPayload).portfolioName === "string"
  );
}

/**
 * Degenerate connector: manual entry has no external system to sync from
 * at all — the user types positions and transactions directly into forms
 * (see the manual-entry UI, which writes Portfolio/Transaction rows
 * directly and calls recomputeHolding, same as every other write path).
 * Every capability is false and every sync method returns empty; this
 * exists only so "manual" is a first-class BrokerageConnector like every
 * other provider, per docs/phase-0's provider-agnostic requirement, not
 * because it fetches anything.
 *
 * connect() just creates the Portfolio row so the manual-entry UI has
 * somewhere to attach transactions to — connectionId == portfolioId, same
 * convention as robinhood-mcp.
 */
export const manualConnector: BrokerageConnector = {
  provider: "MANUAL",
  capabilities: {
    accounts: false,
    balances: false,
    positions: false,
    transactions: false,
    taxLots: false,
    watchlists: false,
    trading: false,
  },

  async connect(input): Promise<ConnectionResult> {
    if (input.provider !== "MANUAL") {
      throw new Error(`manualConnector.connect called with provider "${input.provider}"`);
    }
    if (!isManualPayload(input.payload)) {
      throw new Error("manualConnector.connect requires payload: { userId, portfolioName }");
    }

    const prisma = forUser(input.payload.userId);
    const portfolio = await prisma.portfolio.create({
      data: { workspaceId: input.workspaceId, name: input.payload.portfolioName, source: "MANUAL" },
    });

    return { connectionId: portfolio.id, status: "CONNECTED", connectedAt: new Date().toISOString() };
  },

  async disconnect(): Promise<void> {
    // No external connection to tear down — the Portfolio itself is
    // deleted (if desired) through the portfolio deletion flow, not here.
  },

  async syncAccounts(): Promise<BrokerageAccount[]> {
    return [];
  },

  async syncBalances(): Promise<AccountBalance[]> {
    return [];
  },

  async syncPositions(): Promise<BrokeragePosition[]> {
    return [];
  },

  async syncTransactions(): Promise<TransactionSyncResult> {
    return { transactions: [], nextCursor: null, hasMore: false };
  },

  async syncTaxLots(): Promise<TaxLotSyncResult> {
    return { taxLots: [] };
  },

  async healthCheck(): Promise<ConnectorHealth> {
    return {
      status: "OK",
      lastCheckedAt: new Date().toISOString(),
      message: "Manual entry has no external dependency",
    };
  },
};
