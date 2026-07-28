import { describe, expect, it } from "vitest";

import type { Quote } from "@/shared/contracts/market-data-provider";
import { DEFAULT_CONCENTRATION_THRESHOLD_PCT, aggregatePortfolio, type HoldingInput } from "./aggregate";

function quote(ticker: string, price: string, previousClose: string | null = null): Quote {
  return {
    ticker,
    price,
    previousClose,
    currency: "USD",
    marketTimestamp: "2026-07-27T12:00:00.000Z",
    retrievedAt: "2026-07-27T12:00:00.000Z",
    isDelayed: false,
    source: "test",
  };
}

const now = new Date("2026-07-27T12:05:00.000Z");

describe("aggregatePortfolio", () => {
  it("computes invested capital as the sum of cost bases regardless of quote availability", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "0",
      },
      {
        companyId: "b",
        ticker: "BBB",
        name: "B Co",
        assetType: "STOCK",
        quantity: "5",
        averageCost: "200",
        realizedGainLoss: "0",
      },
    ];

    const result = aggregatePortfolio(holdings, new Map(), now);

    expect(result.investedCapital).toBe("2000"); // 10*100 + 5*200
  });

  it("computes market value, unrealized gain/loss, and allocation when a quote is available", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "0",
      },
    ];
    const quotes = new Map([["AAA", quote("AAA", "150")]]);

    const result = aggregatePortfolio(holdings, quotes, now);

    expect(result.isPartial).toBe(false);
    expect(result.estimatedMarketValue).toBe("1500");
    expect(result.totalUnrealizedGainLoss).toBe("500");
    expect(result.totalUnrealizedGainLossPct).toBe("50");
    expect(result.holdings[0].allocationPct).toBe("100");
  });

  it("marks the aggregate partial and falls back to cost basis when a quote is missing", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "0",
      },
      {
        companyId: "b",
        ticker: "BBB",
        name: "B Co",
        assetType: "STOCK",
        quantity: "5",
        averageCost: "200",
        realizedGainLoss: "0",
      },
    ];
    const quotes = new Map([["AAA", quote("AAA", "150")]]); // BBB has no quote

    const result = aggregatePortfolio(holdings, quotes, now);

    expect(result.isPartial).toBe(true);
    // AAA market value 1500 + BBB cost-basis fallback 1000
    expect(result.estimatedMarketValue).toBe("2500");
    const bbb = result.holdings.find((h) => h.ticker === "BBB")!;
    expect(bbb.marketValue).toBeNull();
    expect(bbb.quoteUnavailable).toBe(true);
  });

  it("computes daily gain/loss from previousClose", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "0",
      },
    ];
    const quotes = new Map([["AAA", quote("AAA", "110", "100")]]);

    const result = aggregatePortfolio(holdings, quotes, now);

    expect(result.totalDailyGainLoss).toBe("100"); // (110-100)*10
    expect(result.holdings[0].dailyGainLossPct).toBe("10");
  });

  it("flags a holding over the concentration threshold", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "95",
        averageCost: "1",
        realizedGainLoss: "0",
      },
      {
        companyId: "b",
        ticker: "BBB",
        name: "B Co",
        assetType: "STOCK",
        quantity: "5",
        averageCost: "1",
        realizedGainLoss: "0",
      },
    ];

    const result = aggregatePortfolio(holdings, new Map(), now);

    const aaa = result.holdings.find((h) => h.ticker === "AAA")!;
    expect(Number(aaa.allocationPct)).toBeGreaterThan(DEFAULT_CONCENTRATION_THRESHOLD_PCT);
    expect(aaa.isOverConcentrationThreshold).toBe(true);
    expect(result.concentrationWarnings.map((h) => h.ticker)).toEqual(["AAA"]);
  });

  it("sorts largest positions by allocation descending", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "SMALL",
        name: "Small Co",
        assetType: "STOCK",
        quantity: "1",
        averageCost: "10",
        realizedGainLoss: "0",
      },
      {
        companyId: "b",
        ticker: "BIG",
        name: "Big Co",
        assetType: "STOCK",
        quantity: "100",
        averageCost: "10",
        realizedGainLoss: "0",
      },
    ];

    const result = aggregatePortfolio(holdings, new Map(), now);

    expect(result.largestPositions[0].ticker).toBe("BIG");
  });

  it("preserves realized gain/loss even for holdings with no current quote", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "250",
      },
    ];

    const result = aggregatePortfolio(holdings, new Map(), now);

    expect(result.totalRealizedGainLoss).toBe("250");
  });

  it("carries the isStale flag from the quote's market timestamp", () => {
    const holdings: HoldingInput[] = [
      {
        companyId: "a",
        ticker: "AAA",
        name: "A Co",
        assetType: "STOCK",
        quantity: "10",
        averageCost: "100",
        realizedGainLoss: "0",
      },
    ];
    const staleQuote: Quote = { ...quote("AAA", "150"), marketTimestamp: "2026-07-27T10:00:00.000Z" }; // 2h before `now`

    const result = aggregatePortfolio(holdings, new Map([["AAA", staleQuote]]), now);

    expect(result.holdings[0].isStale).toBe(true);
  });
});
