import type { MarketDataProvider } from "@/shared/contracts/market-data-provider";

/**
 * Fail-closed default when no real market-data provider is configured
 * (FINNHUB_API_KEY unset — see src/lib/env.ts). Every method resolves to
 * "no data" rather than throwing, so a missing API key degrades the UI to
 * an "unavailable" state instead of taking down pages that don't strictly
 * need live prices (see docs/phase-0/09-security-model.md's reliability
 * principle: a failed provider must not make the rest of the app unusable).
 */
export const unavailableMarketDataProvider: MarketDataProvider = {
  name: "unavailable",
  async getQuote() {
    return null;
  },
  async getHistoricalPrices() {
    return [];
  },
  async getCorporateActions() {
    return [];
  },
  async getSecurityMetadata() {
    return null;
  },
  async getNextEarningsDate() {
    return null;
  },
  async getEarningsCalendar() {
    return [];
  },
  async getCompanyNews() {
    return [];
  },
  async getFundamentalRatios() {
    return null;
  },
  async getAnalystRecommendations() {
    return [];
  },
};
