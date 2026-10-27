import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketDataProvider, Quote } from "@/shared/contracts/market-data-provider";

const findMany = vi.fn();
const upsert = vi.fn().mockResolvedValue(undefined);
const afterCallbacks: Array<() => Promise<void>> = [];

vi.mock("@/lib/db/prisma-service", () => ({
  prismaService: {
    quoteCache: {
      findMany: (...args: unknown[]) => findMany(...args),
      upsert: (...a: unknown[]) => upsert(...a),
    },
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock("next/server", () => ({
  after: (fn: () => Promise<void>) => {
    afterCallbacks.push(fn);
  },
}));

function row(ticker: string, ageMinutes: number) {
  const retrievedAt = new Date(Date.now() - ageMinutes * 60_000);
  return {
    ticker,
    price: "100",
    previousClose: "99",
    currency: "USD",
    marketTimestamp: retrievedAt,
    retrievedAt,
    isDelayed: false,
    source: "finnhub",
  };
}

function makeProvider() {
  const getQuote = vi.fn(async (ticker: string): Promise<Quote> => ({
    ticker,
    price: "200",
    previousClose: "199",
    currency: "USD",
    marketTimestamp: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    isDelayed: false,
    source: "finnhub",
  }));
  return { provider: { name: "fake", getQuote } as unknown as MarketDataProvider, getQuote };
}

async function load() {
  vi.resetModules();
  return (await import("./quote-cache")).getCachedQuotes;
}

beforeEach(() => {
  findMany.mockReset();
  upsert.mockClear();
  afterCallbacks.length = 0;
});

describe("getCachedQuotes", () => {
  it("serves stale rows immediately and refreshes them after the response, stalest first", async () => {
    const getCachedQuotes = await load();
    const { provider, getQuote } = makeProvider();
    findMany.mockResolvedValue([row("AAA", 1), row("BBB", 120), row("CCC", 45)]);

    const result = await getCachedQuotes(["AAA", "BBB", "CCC"], provider);

    expect(result.get("BBB")?.price).toBe("100");
    expect(getQuote).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);

    await afterCallbacks[0]();
    expect(getQuote.mock.calls.map((c) => c[0])).toEqual(["BBB", "CCC"]);
  });

  it("only blocks on a few never-cached tickers and defers the rest", async () => {
    const getCachedQuotes = await load();
    const { provider, getQuote } = makeProvider();
    findMany.mockResolvedValue([]);
    const tickers = Array.from({ length: 9 }, (_, i) => `T${i}`);

    const result = await getCachedQuotes(tickers, provider);

    expect(getQuote).toHaveBeenCalledTimes(6);
    expect(result.size).toBe(6);
    await afterCallbacks[0]();
    expect(getQuote).toHaveBeenCalledTimes(9);
  });

  it("does not queue a ticker that is already being refreshed", async () => {
    const getCachedQuotes = await load();
    const { provider } = makeProvider();
    findMany.mockResolvedValue([row("AAA", 90)]);

    await getCachedQuotes(["AAA"], provider);
    await getCachedQuotes(["AAA"], provider);

    expect(afterCallbacks).toHaveLength(1);
  });

  it("forceRefresh skips the cache read and waits for live quotes", async () => {
    const getCachedQuotes = await load();
    const { provider, getQuote } = makeProvider();

    const result = await getCachedQuotes(["AAA", "BBB"], provider, { forceRefresh: true });

    expect(findMany).not.toHaveBeenCalled();
    expect(getQuote).toHaveBeenCalledTimes(2);
    expect(result.get("AAA")?.price).toBe("200");
    expect(afterCallbacks).toHaveLength(0);
  });
});
