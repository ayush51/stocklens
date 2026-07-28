import { prismaService } from "@/lib/db/prisma-service";
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
import {
  syncPortfolioFromMcpSnapshot,
  type McpPositionSnapshot,
} from "@/features/brokerage-sync/server/ingest";

interface RobinhoodMcpConnectPayload {
  positions: McpPositionSnapshot[];
}

function isRobinhoodMcpPayload(payload: unknown): payload is RobinhoodMcpConnectPayload {
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray((payload as { positions?: unknown }).positions)
  );
}

/**
 * Wraps the existing MCP-assisted ingest (syncPortfolioFromMcpSnapshot) in
 * the standard BrokerageConnector shape. connectionId == portfolioId —
 * BrokerageConnection is already 1:1 with Portfolio in the schema, so
 * there's no separate id to invent.
 *
 * syncPositions() cannot "fetch" anything live the way a real API adapter
 * would: the robinhood-trading MCP tools only exist inside a Claude chat
 * session and are never reachable from this server code (see
 * ROBINHOOD_MCP_SECURITY_PLAN.md). connect() is where new data actually
 * enters the system — via a snapshot Claude already fetched with the
 * user's authorization — and syncPositions() just reads that back out of
 * Supabase in the connector's normalized shape.
 */
export const robinhoodMcpConnector: BrokerageConnector = {
  provider: "ROBINHOOD_MCP",
  capabilities: {
    accounts: false, // no per-account modeling yet — one portfolio per workspace, see ingest.ts
    balances: false, // cash isn't tracked yet
    positions: true,
    transactions: false, // ingest.ts writes a position snapshot, not a transaction ledger
    taxLots: false,
    watchlists: false,
    trading: false,
  },

  async connect(input): Promise<ConnectionResult> {
    if (input.provider !== "ROBINHOOD_MCP") {
      throw new Error(`robinhoodMcpConnector.connect called with provider "${input.provider}"`);
    }
    if (!isRobinhoodMcpPayload(input.payload)) {
      throw new Error("robinhoodMcpConnector.connect requires payload: { positions: McpPositionSnapshot[] }");
    }

    const result = await syncPortfolioFromMcpSnapshot(input.workspaceId, input.payload.positions);

    return {
      connectionId: result.portfolioId,
      status: "CONNECTED",
      connectedAt: new Date().toISOString(),
    };
  },

  async disconnect(connectionId): Promise<void> {
    await prismaService.brokerageConnection.updateMany({
      where: { portfolioId: connectionId },
      data: { status: "DISCONNECTED" },
    });
  },

  async syncAccounts(): Promise<BrokerageAccount[]> {
    return [];
  },

  async syncBalances(): Promise<AccountBalance[]> {
    return [];
  },

  async syncPositions(connectionId): Promise<BrokeragePosition[]> {
    const holdings = await prismaService.holding.findMany({
      where: { portfolioId: connectionId, quantity: { not: 0 } },
      include: { company: true },
    });

    return holdings.map((holding) => ({
      accountExternalId: connectionId,
      ticker: holding.company.ticker,
      quantity: holding.quantity.toString(),
      averageCost: holding.averageCost.toString(),
      asOf: holding.updatedAt.toISOString(),
    }));
  },

  async syncTransactions(): Promise<TransactionSyncResult> {
    return { transactions: [], nextCursor: null, hasMore: false };
  },

  async syncTaxLots(): Promise<TaxLotSyncResult> {
    return { taxLots: [] };
  },

  async healthCheck(connectionId): Promise<ConnectorHealth> {
    const connection = await prismaService.brokerageConnection.findUnique({
      where: { portfolioId: connectionId },
    });

    if (!connection) {
      return { status: "DOWN", lastCheckedAt: new Date().toISOString(), message: "No connection found" };
    }

    return {
      status: connection.status === "CONNECTED" ? "OK" : "DEGRADED",
      lastCheckedAt: new Date().toISOString(),
      message: connection.lastSyncedAt
        ? `Last synced ${connection.lastSyncedAt.toISOString()}`
        : "Never synced",
    };
  },
};
