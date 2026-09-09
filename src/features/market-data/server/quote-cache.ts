import { prismaService } from "@/lib/db/prisma-service";
import { logger } from "@/lib/logger";
import type { Quote, MarketDataProvider } from "@/shared/contracts/market-data-provider";

/**
 * How long a cached quote is trusted before a page load pays to refetch it
 * live. 10 minutes — a portfolio overview doesn't need tick-by-tick prices,
 * and Finnhub's real rate limit (~1 req/sec, serialized across the whole
 * app — see the finnhub provider's own comment) makes fetching 30+ tickers
 * live on every single page load take 30+ seconds, which is the actual
 * "not loading in time" symptom this cache exists to fix.
 */
const QUOTE_CACHE_FRESHNESS_MS = 10 * 60 * 1000;

function toQuote(row: {
  ticker: string;
  price: { toString(): string };
  previousClose: { toString(): string } | null;
  currency: string;
  marketTimestamp: Date;
  retrievedAt: Date;
  isDelayed: boolean;
  source: string;
}): Quote {
  return {
    ticker: row.ticker,
    price: row.price.toString(),
    previousClose: row.previousClose ? row.previousClose.toString() : null,
    currency: row.currency,
    marketTimestamp: row.marketTimestamp.toISOString(),
    retrievedAt: row.retrievedAt.toISOString(),
    isDelayed: row.isDelayed,
    source: row.source,
  };
}

async function writeThrough(quote: Quote): Promise<void> {
  try {
    await prismaService.quoteCache.upsert({
      where: { ticker: quote.ticker },
      update: {
        price: quote.price,
        previousClose: quote.previousClose,
        currency: quote.currency,
        marketTimestamp: new Date(quote.marketTimestamp),
        retrievedAt: new Date(quote.retrievedAt),
        isDelayed: quote.isDelayed,
        source: quote.source,
      },
      create: {
        ticker: quote.ticker,
        price: quote.price,
        previousClose: quote.previousClose,
        currency: quote.currency,
        marketTimestamp: new Date(quote.marketTimestamp),
        retrievedAt: new Date(quote.retrievedAt),
        isDelayed: quote.isDelayed,
        source: quote.source,
      },
    });
  } catch (error) {
    // Best-effort — a cache-write failure must never break the page that
    // already has the live quote in hand.
    logger.warn("quote_cache_write_failed", {
      ticker: quote.ticker,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Batch quote lookup backed by QuoteCache. Reads every requested ticker in
 * one query, only calls the live provider (still through its own real
 * rate-limit pacing) for tickers that are missing, stale, or explicitly
 * force-refreshed — so a repeat page load for the same holdings costs one
 * DB query and zero live calls instead of one live call per ticker.
 *
 * `forceRefresh: true` (the portfolios page's "Refresh now" button) treats
 * every requested ticker as stale regardless of QuoteCache's age, and the
 * fresh result is written back to the same shared, ticker-keyed cache —
 * so any other page reading the same tickers (dashboard, company detail,
 * signal-convergence's price column) sees the refreshed price on its next
 * load too, with no separate propagation step needed.
 */
export async function getCachedQuotes(
  tickers: string[],
  provider: MarketDataProvider,
  opts?: { forceRefresh?: boolean },
): Promise<Map<string, Quote>> {
  const uniqueTickers = Array.from(new Set(tickers));
  if (uniqueTickers.length === 0) return new Map();

  const cached = opts?.forceRefresh
    ? []
    : await prismaService.quoteCache.findMany({ where: { ticker: { in: uniqueTickers } } });

  const freshCutoff = Date.now() - QUOTE_CACHE_FRESHNESS_MS;
  const result = new Map<string, Quote>();
  const staleTickers: string[] = [];

  const cachedByTicker = new Map(cached.map((row) => [row.ticker, row]));
  for (const ticker of uniqueTickers) {
    const row = cachedByTicker.get(ticker);
    if (row && row.retrievedAt.getTime() >= freshCutoff) {
      result.set(ticker, toQuote(row));
    } else {
      staleTickers.push(ticker);
    }
  }

  if (staleTickers.length === 0) return result;

  const fetched = await Promise.all(
    staleTickers.map(async (ticker) => [ticker, await provider.getQuote(ticker)] as const),
  );

  const writes: Promise<void>[] = [];
  for (const [ticker, quote] of fetched) {
    if (!quote) continue;
    result.set(ticker, quote);
    writes.push(writeThrough(quote));
  }
  await Promise.allSettled(writes);

  return result;
}
