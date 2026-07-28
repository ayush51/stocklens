import { describe, expect, it, vi } from "vitest";

const portfolioCreate = vi.fn();
vi.mock("@/lib/db/rls", () => ({
  forUser: () => ({ portfolio: { create: (...args: unknown[]) => portfolioCreate(...args) } }),
}));

const { manualConnector } = await import("./index");

describe("manualConnector", () => {
  it("has every capability off, including trading", () => {
    expect(manualConnector.capabilities).toEqual({
      accounts: false,
      balances: false,
      positions: false,
      transactions: false,
      taxLots: false,
      watchlists: false,
      trading: false,
    });
  });

  it("connect() rejects a payload missing userId/portfolioName", async () => {
    await expect(
      manualConnector.connect({ provider: "MANUAL", workspaceId: "w1", payload: {} }),
    ).rejects.toThrow(/payload/);
  });

  it("connect() creates a MANUAL-sourced portfolio and returns its id as the connectionId", async () => {
    portfolioCreate.mockResolvedValueOnce({ id: "p1" });

    const result = await manualConnector.connect({
      provider: "MANUAL",
      workspaceId: "w1",
      payload: { userId: "u1", portfolioName: "My Portfolio" },
    });

    expect(portfolioCreate).toHaveBeenCalledWith({
      data: { workspaceId: "w1", name: "My Portfolio", source: "MANUAL" },
    });
    expect(result).toEqual({ connectionId: "p1", status: "CONNECTED", connectedAt: expect.any(String) });
  });

  it("every sync method resolves empty rather than throwing", async () => {
    await expect(manualConnector.syncAccounts("p1")).resolves.toEqual([]);
    await expect(manualConnector.syncBalances("p1")).resolves.toEqual([]);
    await expect(manualConnector.syncPositions("p1")).resolves.toEqual([]);
    await expect(manualConnector.syncTransactions("p1")).resolves.toEqual({
      transactions: [],
      nextCursor: null,
      hasMore: false,
    });
    await expect(manualConnector.syncTaxLots("p1")).resolves.toEqual({ taxLots: [] });
  });
});
