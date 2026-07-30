import { logger } from "@/lib/logger";
import { recordProviderCall } from "@/lib/provider-log";
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
 * Verified against the live API on 2026-07-29 with a real free-tier key.
 * Confirmed working: getQuote, getSecurityMetadata, getNextEarningsDate,
 * getCompanyNews, getFundamentalRatios (including forwardPE — present in
 * this bundle despite the separate consensus-estimates endpoint being
 * paywalled), getAnalystRecommendations, and the unknown-ticker-returns-
 * null/empty path for all of them.
 *
 * getCorporateActions correctly returns an empty array on the free tier —
 * not a bug: Finnhub's /stock/split endpoint responds 403 without a paid
 * plan, and the `!response.ok` check in get() below already treats that as
 * "no data" rather than throwing.
 *
 * getHistoricalPrices used to have the same 403-on-free-tier gap for
 * Finnhub's /stock/candle, so it falls back to Yahoo Finance's unofficial
 * chart endpoint (query1.finance.yahoo.com/v8/finance/chart) — free, no key,
 * verified live on 2026-07-29 to return real daily OHLC bars. It's
 * undocumented and could change or start blocking without notice, so this
 * stays a fallback behind Finnhub (not a replacement), fails closed to an
 * empty array on any error, and is never used for real-time quotes —
 * getQuote still only trusts Finnhub.
 */

const BASE_URL = "https://finnhub.io/api/v1";

interface FinnhubQuoteResponse {
  c: number; // current price
  pc: number; // previous close
  t: number; // unix seconds
}

interface FinnhubCandleResponse {
  c: number[];
  o: number[];
  h: number[];
  l: number[];
  v: number[];
  t: number[]; // unix seconds
  s: "ok" | "no_data";
}

interface FinnhubProfileResponse {
  name?: string;
  exchange?: string;
  currency?: string;
  marketCapitalization?: number; // millions USD
  ticker?: string;
}

interface FinnhubSplitResponse {
  symbol: string;
  date: string; // YYYY-MM-DD
  fromFactor: number;
  toFactor: number;
}

interface FinnhubEarningsCalendarEntry {
  symbol: string;
  date: string; // YYYY-MM-DD
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  quarter: number; // 1-4
  year: number;
  hour: "bmo" | "amc" | "dmh" | "" | null;
}

interface FinnhubEarningsCalendarResponse {
  earningsCalendar: FinnhubEarningsCalendarEntry[];
}

interface FinnhubNewsEntry {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  image?: string;
  datetime: number; // unix seconds
}

interface FinnhubMetricResponse {
  metric?: {
    peTTM?: number;
    forwardPE?: number;
    pbQuarterly?: number;
    pb?: number;
    beta?: number;
    currentDividendYieldTTM?: number;
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    // marketCapitalization/enterpriseValue verified live (2026-07-30) to be
    // reported in millions of USD, not raw dollars (NVDA's marketCapitalization
    // came back as 4752638, i.e. ~$4.75T at millions scale).
    marketCapitalization?: number;
    enterpriseValue?: number;
    evEbitdaTTM?: number;
    pfcfShareTTM?: number;
    pegTTM?: number;
  };
}

interface FinnhubRecommendationEntry {
  symbol: string;
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

function toUnixSeconds(dateStr: string): number {
  return Math.floor(new Date(dateStr).getTime() / 1000);
}

interface YahooChartResponse {
  chart: {
    result:
      | [
          {
            timestamp: number[];
            indicators: {
              quote: [{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }];
            };
          },
        ]
      | null;
  };
}

async function fetchYahooHistoricalPrices(ticker: string, from: string, to: string): Promise<PriceBar[]> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}`);
  url.searchParams.set("period1", String(toUnixSeconds(from)));
  url.searchParams.set("period2", String(toUnixSeconds(to)));
  url.searchParams.set("interval", "1d");

  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!response.ok) {
      logger.warn("yahoo_historicals_fallback_failed", { ticker, status: response.status });
      recordProviderCall({
        provider: "yahoo",
        operation: "chart",
        durationMs: Date.now() - startedAt,
        status: "ERROR",
        errorCategory: `http_${response.status}`,
        usedFallback: true,
      });
      return [];
    }

    const data = (await response.json()) as YahooChartResponse;
    const result = data.chart.result?.[0];
    if (!result) return [];

    const { timestamp, indicators } = result;
    const quote = indicators.quote[0];

    const bars: PriceBar[] = timestamp
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().slice(0, 10),
        open: quote.open[i],
        high: quote.high[i],
        low: quote.low[i],
        close: quote.close[i],
        volume: quote.volume[i],
      }))
      // Yahoo includes a null-filled row for the in-progress trading day.
      .filter(
        (
          bar,
        ): bar is { date: string; open: number; high: number; low: number; close: number; volume: number } =>
          bar.open != null && bar.high != null && bar.low != null && bar.close != null,
      )
      .map((bar) => ({
        date: bar.date,
        open: String(bar.open),
        high: String(bar.high),
        low: String(bar.low),
        close: String(bar.close),
        volume: String(bar.volume ?? 0),
      }));

    recordProviderCall({
      provider: "yahoo",
      operation: "chart",
      durationMs: Date.now() - startedAt,
      status: "SUCCESS",
      usedFallback: true,
    });
    return bars.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    logger.warn("yahoo_historicals_fallback_failed", {
      ticker,
      error: error instanceof Error ? error.message : String(error),
    });
    recordProviderCall({
      provider: "yahoo",
      operation: "chart",
      durationMs: Date.now() - startedAt,
      status: "ERROR",
      errorCategory: "exception",
      usedFallback: true,
    });
    return [];
  }
}

export function createFinnhubMarketDataProvider(
  apiKey: string,
  options: { yahooHistoricalsFallbackEnabled?: boolean } = {},
): MarketDataProvider {
  const yahooHistoricalsFallbackEnabled = options.yahooHistoricalsFallbackEnabled ?? true;

  // Verified live (2026-07-29): bursts of concurrent requests against
  // Finnhub's free tier 429 a meaningful fraction of them. A page with 36
  // holdings (a real portfolio in this app) fires 36 quote requests on
  // every load, so this isn't an edge case. Every request dispatched
  // through this provider instance is serialized through one queue with a
  // minimum spacing between requests, controlling the actual dispatch rate
  // globally rather than just per-caller concurrency.
  //
  // First attempt at this used 150ms spacing (~6.7/sec) reasoning it was
  // "well under 60/min" — that math was simply wrong: 60/min IS 1/sec, so
  // 150ms spacing was actually ~6-7x FASTER than the real limit, which is
  // exactly why live retesting still showed heavy 429s even with the
  // "fix" in place. 1050ms (~57/min, a hair under the documented cap)
  // is the corrected value — re-verified live after this change.
  const MIN_REQUEST_SPACING_MS = 1050;
  const MAX_RETRIES = 2;
  const BASE_DELAY_MS = 2000;
  let dispatchQueue: Promise<void> = Promise.resolve();

  function scheduleDispatch(): Promise<void> {
    const previous = dispatchQueue;
    let release!: () => void;
    dispatchQueue = new Promise((resolve) => {
      release = resolve;
    });
    return previous.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, MIN_REQUEST_SPACING_MS));
      release();
    });
  }

  async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("token", apiKey);

    const startedAt = Date.now();
    let wasRateLimited = false;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await scheduleDispatch();
      const response = await fetch(url, { next: { revalidate: 60 } });

      if (response.ok) {
        recordProviderCall({
          provider: "finnhub",
          operation: path,
          durationMs: Date.now() - startedAt,
          status: "SUCCESS",
          rateLimited: wasRateLimited,
        });
        return (await response.json()) as T;
      }

      if (response.status === 429 && attempt < MAX_RETRIES) {
        wasRateLimited = true;
        const delayMs = BASE_DELAY_MS * 2 ** attempt;
        logger.warn("finnhub_rate_limited_retrying", { path, attempt: attempt + 1, delayMs });
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      if (response.status === 429) wasRateLimited = true;
      logger.warn("finnhub_request_failed", { path, status: response.status, attempt });
      recordProviderCall({
        provider: "finnhub",
        operation: path,
        durationMs: Date.now() - startedAt,
        status: "ERROR",
        errorCategory: `http_${response.status}`,
        rateLimited: wasRateLimited,
      });
      return null;
    }

    return null;
  }

  return {
    name: "finnhub",

    async getQuote(ticker: string): Promise<Quote | null> {
      const data = await get<FinnhubQuoteResponse>("/quote", { symbol: ticker });
      // Finnhub returns c:0/t:0 for an unresolvable symbol rather than a 404.
      if (!data || data.c === 0) return null;

      return {
        ticker,
        price: String(data.c),
        previousClose: data.pc ? String(data.pc) : null,
        currency: "USD",
        marketTimestamp: new Date(data.t * 1000).toISOString(),
        retrievedAt: new Date().toISOString(),
        isDelayed: false,
        source: "finnhub",
      };
    },

    async getHistoricalPrices(ticker: string, from: string, to: string): Promise<PriceBar[]> {
      const data = await get<FinnhubCandleResponse>("/stock/candle", {
        symbol: ticker,
        resolution: "D",
        from: String(toUnixSeconds(from)),
        to: String(toUnixSeconds(to)),
      });
      if (data && data.s === "ok") {
        const bars: PriceBar[] = data.t.map((timestamp, i) => ({
          date: new Date(timestamp * 1000).toISOString().slice(0, 10),
          open: String(data.o[i]),
          high: String(data.h[i]),
          low: String(data.l[i]),
          close: String(data.c[i]),
          volume: String(data.v[i]),
        }));
        return bars.sort((a, b) => a.date.localeCompare(b.date));
      }

      if (!yahooHistoricalsFallbackEnabled) {
        logger.info("yahoo_historicals_fallback_disabled", { ticker });
        return [];
      }

      return fetchYahooHistoricalPrices(ticker, from, to);
    },

    async getCorporateActions(ticker: string, from: string, to: string): Promise<CorporateAction[]> {
      const splits = await get<FinnhubSplitResponse[]>("/stock/split", { symbol: ticker, from, to });
      if (!splits) return [];

      return splits.map((split) => ({
        ticker,
        type: "SPLIT" as const,
        exDate: split.date,
        splitRatio: `${split.toFactor}:${split.fromFactor}`,
        dividendAmount: null,
      }));
    },

    async getSecurityMetadata(ticker: string): Promise<SecurityMetadata | null> {
      const data = await get<FinnhubProfileResponse>("/stock/profile2", { symbol: ticker });
      if (!data || !data.name) return null;

      return {
        ticker,
        name: data.name,
        exchange: data.exchange ?? null,
        currency: data.currency ?? "USD",
        marketCap:
          typeof data.marketCapitalization === "number"
            ? String(data.marketCapitalization * 1_000_000)
            : null,
      };
    },

    async getNextEarningsDate(ticker: string): Promise<EarningsDate | null> {
      const today = new Date().toISOString().slice(0, 10);
      const oneYearOut = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

      const data = await get<FinnhubEarningsCalendarResponse>("/calendar/earnings", {
        symbol: ticker,
        from: today,
        to: oneYearOut,
      });
      const next = data?.earningsCalendar?.[0];
      if (!next) return null;

      return { ticker, date: next.date, isEstimate: true };
    },

    async getEarningsCalendar(ticker: string, from: string, to: string): Promise<EarningsCalendarEntry[]> {
      const data = await get<FinnhubEarningsCalendarResponse>("/calendar/earnings", {
        symbol: ticker,
        from,
        to,
      });
      if (!data) return [];

      const timingByHour: Record<string, EarningsCalendarEntry["timing"]> = {
        bmo: "BEFORE_MARKET",
        amc: "AFTER_MARKET",
        dmh: "DURING_MARKET",
      };

      return data.earningsCalendar
        .filter((entry) => entry.quarter >= 1 && entry.quarter <= 4)
        .map((entry) => ({
          ticker,
          fiscalYear: entry.year,
          fiscalPeriod: `Q${entry.quarter}` as EarningsCalendarEntry["fiscalPeriod"],
          reportDate: entry.date,
          timing: entry.hour ? (timingByHour[entry.hour] ?? null) : null,
          epsEstimate: entry.epsEstimate !== null ? String(entry.epsEstimate) : null,
          revenueEstimate: entry.revenueEstimate !== null ? String(entry.revenueEstimate) : null,
        }))
        .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
    },

    async getCompanyNews(ticker: string, from: string, to: string): Promise<NewsItem[]> {
      const data = await get<FinnhubNewsEntry[]>("/company-news", { symbol: ticker, from, to });
      if (!data) return [];

      return data.map((entry) => ({
        id: String(entry.id),
        ticker,
        headline: entry.headline,
        summary: entry.summary,
        source: entry.source,
        url: entry.url,
        imageUrl: entry.image || null,
        publishedAt: new Date(entry.datetime * 1000).toISOString(),
      }));
    },

    async getFundamentalRatios(ticker: string): Promise<FundamentalRatios | null> {
      const data = await get<FinnhubMetricResponse>("/stock/metric", { symbol: ticker, metric: "all" });
      const metric = data?.metric;
      // Finnhub returns 200 with {"metric":{}} for an unresolvable symbol
      // rather than a 404/empty body — verified directly, not assumed.
      if (!metric || Object.keys(metric).length === 0) return null;

      const toStringOrNull = (value: number | undefined) =>
        typeof value === "number" ? String(value) : null;
      const millionsToUsdOrNull = (value: number | undefined) =>
        typeof value === "number" ? String(value * 1_000_000) : null;

      return {
        ticker,
        peRatioTrailing: toStringOrNull(metric.peTTM),
        peRatioForward: toStringOrNull(metric.forwardPE),
        priceToBook: toStringOrNull(metric.pbQuarterly ?? metric.pb),
        beta: toStringOrNull(metric.beta),
        dividendYieldTtm: toStringOrNull(metric.currentDividendYieldTTM),
        week52High: toStringOrNull(metric["52WeekHigh"]),
        week52Low: toStringOrNull(metric["52WeekLow"]),
        marketCap: millionsToUsdOrNull(metric.marketCapitalization),
        enterpriseValue: millionsToUsdOrNull(metric.enterpriseValue),
        evToEbitdaTtm: toStringOrNull(metric.evEbitdaTTM),
        priceToFcfTtm: toStringOrNull(metric.pfcfShareTTM),
        pegRatioTtm: toStringOrNull(metric.pegTTM),
        asOf: new Date().toISOString(),
      };
    },

    async getAnalystRecommendations(ticker: string): Promise<AnalystRecommendation[]> {
      const data = await get<FinnhubRecommendationEntry[]>("/stock/recommendation", { symbol: ticker });
      if (!data) return [];

      return data.map((entry) => ({
        ticker,
        period: entry.period,
        strongBuy: entry.strongBuy,
        buy: entry.buy,
        hold: entry.hold,
        sell: entry.sell,
        strongSell: entry.strongSell,
      }));
    },
  };
}
