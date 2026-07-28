import type {
  CorporateAction,
  EarningsDate,
  MarketDataProvider,
  PriceBar,
  Quote,
  SecurityMetadata,
} from "@/shared/contracts/market-data-provider";

/**
 * Deterministic in-memory MarketDataProvider for tests and for any local
 * development that shouldn't depend on a live vendor API. Not wired into
 * the app's provider factory (get-provider.ts) — only imported by tests.
 */
const FIXTURES: Record<
  string,
  {
    quote: Quote;
    bars: PriceBar[];
    actions: CorporateAction[];
    metadata: SecurityMetadata;
    earnings: EarningsDate;
  }
> = {
  AAPL: {
    quote: {
      ticker: "AAPL",
      price: "227.50",
      previousClose: "225.00",
      currency: "USD",
      marketTimestamp: "2026-07-25T20:00:00.000Z",
      retrievedAt: "2026-07-27T12:00:00.000Z",
      isDelayed: false,
      source: "fake",
    },
    bars: [
      { date: "2026-07-23", open: "220", high: "224", low: "219", close: "223", volume: "1000000" },
      { date: "2026-07-24", open: "223", high: "227", low: "222", close: "225", volume: "1100000" },
      { date: "2026-07-25", open: "225", high: "229", low: "224", close: "227.5", volume: "1200000" },
    ],
    actions: [
      { ticker: "AAPL", type: "DIVIDEND", exDate: "2026-08-08", splitRatio: null, dividendAmount: "0.26" },
    ],
    metadata: {
      ticker: "AAPL",
      name: "Apple Inc.",
      exchange: "NASDAQ",
      currency: "USD",
      marketCap: "3400000000000",
    },
    earnings: { ticker: "AAPL", date: "2026-10-30", isEstimate: true },
  },
};

export function createFakeMarketDataProvider(): MarketDataProvider {
  return {
    name: "fake",
    async getQuote(ticker) {
      return FIXTURES[ticker]?.quote ?? null;
    },
    async getHistoricalPrices(ticker, from, to) {
      const bars = FIXTURES[ticker]?.bars ?? [];
      return bars.filter((bar) => bar.date >= from && bar.date <= to);
    },
    async getCorporateActions(ticker, from, to) {
      const actions = FIXTURES[ticker]?.actions ?? [];
      return actions.filter((action) => action.exDate >= from && action.exDate <= to);
    },
    async getSecurityMetadata(ticker) {
      return FIXTURES[ticker]?.metadata ?? null;
    },
    async getNextEarningsDate(ticker) {
      return FIXTURES[ticker]?.earnings ?? null;
    },
  };
}
