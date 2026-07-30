import type {
  AnalystRecommendation,
  CorporateAction,
  EarningsCalendarEntry,
  EarningsDate,
  FundamentalRatios,
  MarketDataProvider,
  NewsItem,
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
    earningsCalendar: EarningsCalendarEntry[];
    news: NewsItem[];
    ratios: FundamentalRatios;
    recommendations: AnalystRecommendation[];
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
    earningsCalendar: [
      {
        ticker: "AAPL",
        fiscalYear: 2027,
        fiscalPeriod: "Q1",
        reportDate: "2026-10-30",
        timing: "AFTER_MARKET",
        epsEstimate: "1.65",
        revenueEstimate: "95000000000",
      },
    ],
    news: [
      {
        id: "fake-1",
        ticker: "AAPL",
        headline: "Apple announces new product",
        summary: "A fake summary for testing.",
        source: "Fake Wire",
        url: "https://example.com/fake-news-1",
        imageUrl: null,
        publishedAt: "2026-07-26T14:00:00.000Z",
      },
    ],
    ratios: {
      ticker: "AAPL",
      peRatioTrailing: "31.5",
      peRatioForward: "29.2",
      priceToBook: "25.6",
      beta: "1.08",
      dividendYieldTtm: "0.31",
      week52High: "342.89",
      week52Low: "201.50",
      marketCap: "3400000000000",
      enterpriseValue: "3420000000000",
      evToEbitdaTtm: "24.1",
      priceToFcfTtm: "28.3",
      pegRatioTtm: "2.1",
      asOf: "2026-07-27T12:00:00.000Z",
    },
    recommendations: [
      { ticker: "AAPL", period: "2026-07-01", strongBuy: 13, buy: 23, hold: 16, sell: 2, strongSell: 0 },
    ],
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
    async getEarningsCalendar(ticker, from, to) {
      const entries = FIXTURES[ticker]?.earningsCalendar ?? [];
      return entries.filter((entry) => entry.reportDate >= from && entry.reportDate <= to);
    },
    async getCompanyNews(ticker, from, to) {
      const news = FIXTURES[ticker]?.news ?? [];
      return news.filter(
        (item) => item.publishedAt.slice(0, 10) >= from && item.publishedAt.slice(0, 10) <= to,
      );
    },
    async getFundamentalRatios(ticker) {
      return FIXTURES[ticker]?.ratios ?? null;
    },
    async getAnalystRecommendations(ticker) {
      return FIXTURES[ticker]?.recommendations ?? [];
    },
  };
}
