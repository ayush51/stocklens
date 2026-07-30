import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { FINNHUB_API_KEY: undefined, MARKET_DATA_PROVIDER_ENABLED: true } }));

describe("getMarketDataProvider", () => {
  it("falls back to the unavailable provider when FINNHUB_API_KEY is unset", async () => {
    const { getMarketDataProvider } = await import("./get-provider");
    expect(getMarketDataProvider().name).toBe("unavailable");
  });
});

describe("getMarketDataProvider with a key configured", () => {
  it("returns the finnhub provider when FINNHUB_API_KEY is set and enabled", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { FINNHUB_API_KEY: "test-key", MARKET_DATA_PROVIDER_ENABLED: true },
    }));

    const { getMarketDataProvider } = await import("./get-provider");
    expect(getMarketDataProvider().name).toBe("finnhub");
  });

  it("falls back to the unavailable provider when the kill switch is off, even with a real key", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { FINNHUB_API_KEY: "test-key", MARKET_DATA_PROVIDER_ENABLED: false },
    }));

    const { getMarketDataProvider } = await import("./get-provider");
    expect(getMarketDataProvider().name).toBe("unavailable");
  });
});
