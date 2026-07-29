import type {
  AnalystRecommendation,
  CorporateAction,
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
 * getHistoricalPrices and getCorporateActions correctly return an empty
 * array on the free tier — not a bug: Finnhub's /stock/candle and
 * /stock/split endpoints respond 403 ("You don't have access to this
 * resource") without a paid plan, and the `!response.ok` check in get()
 * below already treats that as "no data" rather than throwing. If a paid
 * plan is ever added, these should start returning real data with no code
 * change needed here — re-verify against the live API if that happens,
 * since the response shape itself is still unconfirmed for these two.
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

export function createFinnhubMarketDataProvider(apiKey: string): MarketDataProvider {
  async function get<T>(path: string, params: Record<string, string>): Promise<T | null> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("token", apiKey);

    const response = await fetch(url, { next: { revalidate: 60 } });
    if (!response.ok) return null;
    return (await response.json()) as T;
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
      if (!data || data.s !== "ok") return [];

      const bars: PriceBar[] = data.t.map((timestamp, i) => ({
        date: new Date(timestamp * 1000).toISOString().slice(0, 10),
        open: String(data.o[i]),
        high: String(data.h[i]),
        low: String(data.l[i]),
        close: String(data.c[i]),
        volume: String(data.v[i]),
      }));

      return bars.sort((a, b) => a.date.localeCompare(b.date));
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

      return {
        ticker,
        peRatioTrailing: toStringOrNull(metric.peTTM),
        peRatioForward: toStringOrNull(metric.forwardPE),
        priceToBook: toStringOrNull(metric.pbQuarterly ?? metric.pb),
        beta: toStringOrNull(metric.beta),
        dividendYieldTtm: toStringOrNull(metric.currentDividendYieldTTM),
        week52High: toStringOrNull(metric["52WeekHigh"]),
        week52Low: toStringOrNull(metric["52WeekLow"]),
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
