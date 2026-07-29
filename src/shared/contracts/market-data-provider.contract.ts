import { describe, expect, it } from "vitest";

import type { MarketDataProvider } from "./market-data-provider";

export interface MarketDataProviderContractFixture {
  provider: MarketDataProvider;
  /** A ticker the fixture provider has real data for. */
  validTicker: string;
  /** A ticker the fixture provider has never heard of. */
  unknownTicker: string;
  historicalRange: { from: string; to: string };
}

/**
 * Behavioral contract every MarketDataProvider implementation must satisfy,
 * independent of which vendor backs it — run this against the fake provider
 * (src/features/market-data/providers/fake) and, once credentials exist,
 * against the real one too, so both are held to the same shape/behavior
 * guarantees rather than only being tested against sample data.
 */
export function describeMarketDataProviderContract(fixture: MarketDataProviderContractFixture) {
  describe(`${fixture.provider.name} market-data provider contract`, () => {
    it("resolves null (never throws) for an unknown ticker's quote", async () => {
      await expect(fixture.provider.getQuote(fixture.unknownTicker)).resolves.toBeNull();
    });

    it("resolves null for an unknown ticker's security metadata", async () => {
      await expect(fixture.provider.getSecurityMetadata(fixture.unknownTicker)).resolves.toBeNull();
    });

    it("resolves an empty array (never throws) for an unknown ticker's historical prices", async () => {
      await expect(
        fixture.provider.getHistoricalPrices(
          fixture.unknownTicker,
          fixture.historicalRange.from,
          fixture.historicalRange.to,
        ),
      ).resolves.toEqual([]);
    });

    it("resolves an empty array for an unknown ticker's corporate actions", async () => {
      await expect(
        fixture.provider.getCorporateActions(
          fixture.unknownTicker,
          fixture.historicalRange.from,
          fixture.historicalRange.to,
        ),
      ).resolves.toEqual([]);
    });

    it("echoes the requested ticker back on a known-ticker quote", async () => {
      const quote = await fixture.provider.getQuote(fixture.validTicker);
      expect(quote?.ticker).toBe(fixture.validTicker);
    });

    it("always stamps both a market timestamp and a retrieval timestamp on a quote", async () => {
      const quote = await fixture.provider.getQuote(fixture.validTicker);
      expect(quote?.marketTimestamp).toBeTruthy();
      expect(quote?.retrievedAt).toBeTruthy();
    });

    it("returns historical price bars sorted ascending by date", async () => {
      const bars = await fixture.provider.getHistoricalPrices(
        fixture.validTicker,
        fixture.historicalRange.from,
        fixture.historicalRange.to,
      );
      const dates = bars.map((bar) => bar.date);
      expect(dates).toEqual([...dates].sort());
    });

    it("only returns historical price bars within the requested date range", async () => {
      const bars = await fixture.provider.getHistoricalPrices(
        fixture.validTicker,
        fixture.historicalRange.from,
        fixture.historicalRange.to,
      );
      for (const bar of bars) {
        expect(bar.date >= fixture.historicalRange.from).toBe(true);
        expect(bar.date <= fixture.historicalRange.to).toBe(true);
      }
    });

    it("resolves an empty array (never throws) for an unknown ticker's news", async () => {
      await expect(
        fixture.provider.getCompanyNews(
          fixture.unknownTicker,
          fixture.historicalRange.from,
          fixture.historicalRange.to,
        ),
      ).resolves.toEqual([]);
    });

    it("every news item has a real URL and source, never a fabricated one", async () => {
      const news = await fixture.provider.getCompanyNews(
        fixture.validTicker,
        fixture.historicalRange.from,
        fixture.historicalRange.to,
      );
      for (const item of news) {
        expect(item.url).toMatch(/^https?:\/\//);
        expect(item.source.length).toBeGreaterThan(0);
      }
    });

    it("resolves null for an unknown ticker's fundamental ratios", async () => {
      await expect(fixture.provider.getFundamentalRatios(fixture.unknownTicker)).resolves.toBeNull();
    });

    it("resolves an empty array for an unknown ticker's analyst recommendations", async () => {
      await expect(fixture.provider.getAnalystRecommendations(fixture.unknownTicker)).resolves.toEqual([]);
    });
  });
}
