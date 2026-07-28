import { describe, expect, it } from "vitest";

import { createUnimplementedConnector } from "./index";

describe("createUnimplementedConnector", () => {
  const connector = createUnimplementedConnector("SNAPTRADE");

  it("reports the requested provider with trading disabled and every capability off", () => {
    expect(connector.provider).toBe("SNAPTRADE");
    expect(connector.capabilities).toEqual({
      accounts: false,
      balances: false,
      positions: false,
      transactions: false,
      taxLots: false,
      watchlists: false,
      trading: false,
    });
  });

  it("rejects on every method rather than silently no-op-ing", async () => {
    await expect(
      connector.connect({ provider: "SNAPTRADE", workspaceId: "w1", payload: {} }),
    ).rejects.toThrow(/not implemented/);
    await expect(connector.disconnect("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.syncAccounts("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.syncBalances("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.syncPositions("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.syncTransactions("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.syncTaxLots("c1")).rejects.toThrow(/not implemented/);
    await expect(connector.healthCheck("c1")).rejects.toThrow(/not implemented/);
  });
});
