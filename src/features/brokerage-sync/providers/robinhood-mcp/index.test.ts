import { describe, expect, it, vi } from "vitest";

const syncPortfolioFromMcpSnapshot = vi.fn();
vi.mock("@/features/brokerage-sync/server/ingest", () => ({
  syncPortfolioFromMcpSnapshot: (...args: unknown[]) => syncPortfolioFromMcpSnapshot(...args),
}));

const brokerageConnectionUpdateMany = vi.fn();
const brokerageConnectionFindUnique = vi.fn();
const holdingFindMany = vi.fn();
vi.mock("@/lib/db/prisma-service", () => ({
  prismaService: {
    brokerageConnection: {
      updateMany: (...args: unknown[]) => brokerageConnectionUpdateMany(...args),
      findUnique: (...args: unknown[]) => brokerageConnectionFindUnique(...args),
    },
    holding: {
      findMany: (...args: unknown[]) => holdingFindMany(...args),
    },
  },
}));

const { robinhoodMcpConnector } = await import("./index");

describe("robinhoodMcpConnector", () => {
  it("reports positions-only capabilities with trading disabled", () => {
    expect(robinhoodMcpConnector.capabilities).toEqual({
      accounts: false,
      balances: false,
      positions: true,
      transactions: false,
      taxLots: false,
      watchlists: false,
      trading: false,
    });
  });

  it("connect() rejects a payload without a positions array", async () => {
    await expect(
      robinhoodMcpConnector.connect({ provider: "ROBINHOOD_MCP", workspaceId: "w1", payload: {} }),
    ).rejects.toThrow(/positions/);
  });

  it("connect() rejects a mismatched provider", async () => {
    await expect(
      robinhoodMcpConnector.connect({ provider: "MANUAL", workspaceId: "w1", payload: { positions: [] } }),
    ).rejects.toThrow(/provider/);
  });

  it("connect() delegates to syncPortfolioFromMcpSnapshot and maps the result", async () => {
    syncPortfolioFromMcpSnapshot.mockResolvedValueOnce({
      portfolioId: "p1",
      synced: [{ ticker: "AAPL", companyId: "c1" }],
      skipped: [],
      closed: [],
    });

    const positions = [{ ticker: "AAPL", quantity: "10", averageCost: "150" }];
    const result = await robinhoodMcpConnector.connect({
      provider: "ROBINHOOD_MCP",
      workspaceId: "w1",
      payload: { positions },
    });

    expect(syncPortfolioFromMcpSnapshot).toHaveBeenCalledWith("w1", positions);
    expect(result.connectionId).toBe("p1");
    expect(result.status).toBe("CONNECTED");
  });

  it("disconnect() marks the connection disconnected by portfolioId", async () => {
    await robinhoodMcpConnector.disconnect("p1");

    expect(brokerageConnectionUpdateMany).toHaveBeenCalledWith({
      where: { portfolioId: "p1" },
      data: { status: "DISCONNECTED" },
    });
  });

  it("syncPositions() reads holdings back from the database rather than fetching live", async () => {
    holdingFindMany.mockResolvedValueOnce([
      {
        quantity: { toString: () => "10" },
        averageCost: { toString: () => "150" },
        updatedAt: new Date("2026-07-27T00:00:00.000Z"),
        company: { ticker: "AAPL" },
      },
    ]);

    const positions = await robinhoodMcpConnector.syncPositions("p1");

    expect(positions).toEqual([
      {
        accountExternalId: "p1",
        ticker: "AAPL",
        quantity: "10",
        averageCost: "150",
        asOf: "2026-07-27T00:00:00.000Z",
      },
    ]);
  });

  it("healthCheck() reflects the persisted connection status", async () => {
    brokerageConnectionFindUnique.mockResolvedValueOnce({ status: "CONNECTED", lastSyncedAt: null });

    const health = await robinhoodMcpConnector.healthCheck("p1");

    expect(health.status).toBe("OK");
  });

  it("healthCheck() reports DOWN when no connection row exists", async () => {
    brokerageConnectionFindUnique.mockResolvedValueOnce(null);

    const health = await robinhoodMcpConnector.healthCheck("missing");

    expect(health.status).toBe("DOWN");
  });
});
