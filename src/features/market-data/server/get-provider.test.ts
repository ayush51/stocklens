import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { FINNHUB_API_KEY: undefined } }));

describe("getMarketDataProvider", () => {
  it("falls back to the unavailable provider when FINNHUB_API_KEY is unset", async () => {
    const { getMarketDataProvider } = await import("./get-provider");
    expect(getMarketDataProvider().name).toBe("unavailable");
  });
});

describe("getMarketDataProvider with a key configured", () => {
  it("returns the finnhub provider when FINNHUB_API_KEY is set", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({ env: { FINNHUB_API_KEY: "test-key" } }));

    const { getMarketDataProvider } = await import("./get-provider");
    expect(getMarketDataProvider().name).toBe("finnhub");
  });
});
