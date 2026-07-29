/**
 * Market-data boundary — implemented by features/market-data/providers/*
 * so feature code never talks to a vendor SDK or raw fetch call directly.
 * See docs/phase-0/02-architecture.md §3 and the filings/brokerage-sync
 * contracts for the same pattern.
 *
 * Every value that can be stale, delayed, or simply unavailable says so
 * explicitly — nothing in this interface may fabricate a price. A provider
 * that can't answer returns null, never a guess.
 */

export interface Quote {
  ticker: string;
  price: string; // decimal string — parsed to Prisma Decimal at the write boundary
  previousClose: string | null;
  currency: string;
  /** When the exchange last updated this price, not when we fetched it. */
  marketTimestamp: string; // ISO 8601
  /** When this application retrieved the quote. */
  retrievedAt: string; // ISO 8601
  isDelayed: boolean;
  source: string; // provider name, e.g. "finnhub"
}

export interface PriceBar {
  date: string; // YYYY-MM-DD
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface CorporateAction {
  ticker: string;
  type: "SPLIT" | "DIVIDEND";
  exDate: string; // YYYY-MM-DD
  /** Split ratio as new:old, e.g. "4:1". Only set when type is SPLIT. */
  splitRatio: string | null;
  /** Cash amount per share. Only set when type is DIVIDEND. */
  dividendAmount: string | null;
}

export interface SecurityMetadata {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  marketCap: string | null;
}

export interface EarningsDate {
  ticker: string;
  date: string; // YYYY-MM-DD
  isEstimate: boolean;
}

/**
 * A single scheduled earnings report, with consensus estimates.
 * epsActual/revenueActual are deliberately NOT part of this shape — verified
 * live against Finnhub's real API (2026-07-29) that its free-tier
 * /calendar/earnings endpoint only returns upcoming reports with estimates,
 * never past reports with actuals (a date-range query entirely in the past
 * returns an empty array, not historical rows). Actual reported figures
 * come from FinancialStatement (real SEC EDGAR XBRL data) once filed,
 * joined by fiscalYear/fiscalPeriod — see earnings/server/queries.ts.
 */
export interface EarningsCalendarEntry {
  ticker: string;
  fiscalYear: number;
  fiscalPeriod: "Q1" | "Q2" | "Q3" | "Q4";
  reportDate: string; // YYYY-MM-DD
  /** When in the trading day the report is expected — null when the provider doesn't say. */
  timing: "BEFORE_MARKET" | "AFTER_MARKET" | "DURING_MARKET" | null;
  epsEstimate: string | null;
  revenueEstimate: string | null;
}

export interface NewsItem {
  id: string;
  ticker: string;
  headline: string;
  summary: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string; // ISO 8601
}

/**
 * Fields are null, not zero or guessed, when the provider doesn't have or
 * doesn't expose them. peRatioForward comes from Finnhub's basic-financials
 * bundle (confirmed present on the free tier), which is a different
 * endpoint from — and available despite — its dedicated consensus-estimates
 * endpoint being paywalled; treat it as Finnhub's own computed figure, not
 * something this app derives.
 */
export interface FundamentalRatios {
  ticker: string;
  peRatioTrailing: string | null;
  peRatioForward: string | null;
  priceToBook: string | null;
  beta: string | null;
  dividendYieldTtm: string | null;
  week52High: string | null;
  week52Low: string | null;
  asOf: string; // ISO 8601 — retrieval time, this is a snapshot of a slow-changing bundle
}

export interface AnalystRecommendation {
  ticker: string;
  period: string; // YYYY-MM-DD, first of month
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface MarketDataProvider {
  readonly name: string;
  getQuote(ticker: string): Promise<Quote | null>;
  getHistoricalPrices(ticker: string, from: string, to: string): Promise<PriceBar[]>;
  getCorporateActions(ticker: string, from: string, to: string): Promise<CorporateAction[]>;
  getSecurityMetadata(ticker: string): Promise<SecurityMetadata | null>;
  getNextEarningsDate(ticker: string): Promise<EarningsDate | null>;
  /** All scheduled reports for a ticker within [from, to] — see EarningsCalendarEntry's doc comment for why this never includes actuals. */
  getEarningsCalendar(ticker: string, from: string, to: string): Promise<EarningsCalendarEntry[]>;
  getCompanyNews(ticker: string, from: string, to: string): Promise<NewsItem[]>;
  getFundamentalRatios(ticker: string): Promise<FundamentalRatios | null>;
  getAnalystRecommendations(ticker: string): Promise<AnalystRecommendation[]>;
}
