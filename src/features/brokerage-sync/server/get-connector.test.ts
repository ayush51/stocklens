import { describe, expect, it, vi } from "vitest";

// This test only inspects capabilities/provider and exercises the
// unimplemented stubs (which throw before touching the database), but
// importing getBrokerageConnector still pulls in prismaService/prisma
// transitively (robinhood-mcp, manual, ingest.ts all depend on them),
// which validates real env vars at module-load time — mock env so that
// import doesn't throw outside a real Next.js process.
vi.mock("@/lib/env", () => ({
  env: {
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
    SERVICE_DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    NEXT_PUBLIC_SUPABASE_URL: "https://placeholder.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "placeholder",
    SUPABASE_SERVICE_ROLE_KEY: "placeholder",
    FINNHUB_API_KEY: undefined,
  },
}));

const { getBrokerageConnector } = await import("./get-connector");

describe("getBrokerageConnector", () => {
  it("returns the real robinhood-mcp connector", () => {
    expect(getBrokerageConnector("ROBINHOOD_MCP").provider).toBe("ROBINHOOD_MCP");
    expect(getBrokerageConnector("ROBINHOOD_MCP").capabilities.positions).toBe(true);
  });

  it("returns the real manual connector", () => {
    expect(getBrokerageConnector("MANUAL").provider).toBe("MANUAL");
  });

  it("returns an unimplemented stub for CSV_IMPORT until its real parser lands", async () => {
    const connector = getBrokerageConnector("CSV_IMPORT");
    expect(connector.provider).toBe("CSV_IMPORT");
    await expect(connector.syncPositions("c1")).rejects.toThrow(/not implemented/);
  });

  it("returns unimplemented stubs for SNAPTRADE and PLAID", async () => {
    await expect(getBrokerageConnector("SNAPTRADE").syncPositions("c1")).rejects.toThrow(/not implemented/);
    await expect(getBrokerageConnector("PLAID").syncPositions("c1")).rejects.toThrow(/not implemented/);
  });

  it("every connector reports trading disabled", () => {
    const providers = ["ROBINHOOD_MCP", "MANUAL", "CSV_IMPORT", "SNAPTRADE", "PLAID"] as const;
    for (const provider of providers) {
      expect(getBrokerageConnector(provider).capabilities.trading).toBe(false);
    }
  });
});
