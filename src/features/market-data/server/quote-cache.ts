import { after } from "next/server";

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

/**
 * A ticker with no cached row at all has nothing to show, so a page load
 * waits for its live quote — but only for this many at a time. Finnhub's
 * pacing means each one costs ~1 second, so the rest are filled in after
 * the response instead of holding the page hostage for 30+ seconds.
 */
const MAX_BLOCKING_LIVE_FETCHES = 6;

/**
 * Stale (but present) tickers are served as-is and refreshed after the
 * response; this caps how many one page load queues so a burst of loads
 * can't build an unbounded backlog behind Finnhub's rate limit.
 */
const MAX_BACKGROUND_REFRESHES = 15;

/** Tickers already being refreshed by some earlier request in this instance. */
const refreshing = new Set<string>();

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

async function fetchAndStore(tickers: string[], provider: MarketDataProvider): Promise<Map<string, Quote>> {
  const fetched = await Promise.all(
    tickers.map(async (ticker) => [ticker, await provider.getQuote(ticker)] as const),
  );

  const result = new Map<string, Quote>();
  const writes: Promise<void>[] = [];
  for (const [ticker, quote] of fetched) {
    if (!quote) continue;
    result.set(ticker, quote);
    writes.push(writeThrough(quote));
  }
  await Promise.allSettled(writes);
  return result;
}

/**
 * Refreshes tickers after the response has been sent (Next's after()), so
 * the visitor who triggered it never waits on Finnhub. Falls back to a
 * plain fire-and-forget outside a request scope (tests, scripts).
 */
function refreshInBackground(tickers: string[], provider: MarketDataProvider): void {
  const toRefresh = tickers.filter((ticker) => !refreshing.has(ticker)).slice(0, MAX_BACKGROUND_REFRESHES);
  if (toRefresh.length === 0) return;
  toRefresh.forEach((ticker) => refreshing.add(ticker));

  const work = async () => {
    try {
      await fetchAndStore(toRefresh, provider);
    } catch (error) {
      logger.warn("quote_background_refresh_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      toRefresh.forEach((ticker) => refreshing.delete(ticker));
    }
  };

  try {
    after(work);
  } catch {
    void work();
  }
}

/**
 * Batch quote lookup backed by QuoteCache. Reads every requested ticker in
 * one query and never makes a page wait on the live provider for a quote it
 * already has:
 *
 * - fresh rows (under 10 minutes old) are returned as-is;
 * - stale rows are returned as-is too — the UI already flags old prices
 *   with a "stale" badge — and refreshed after the response, stalest first;
 * - tickers with no row at all are fetched live, up to
 *   MAX_BLOCKING_LIVE_FETCHES; the remainder fill in on a later load.
 *
 * `forceRefresh: true` (the portfolios page's "Refresh now" button) is the
 * one explicit exception: every requested ticker is fetched live and the
 * caller waits, then the result is written back to the same shared,
 * ticker-keyed cache — so any other page reading the same tickers
 * (dashboard, company detail, signal-convergence's price column) sees the
 * refreshed price on its next load too.
 */
export async function getCachedQuotes(
  tickers: string[],
  provider: MarketDataProvider,
  opts?: { forceRefresh?: boolean },
): Promise<Map<string, Quote>> {
  const uniqueTickers = Array.from(new Set(tickers));
  if (uniqueTickers.length === 0) return new Map();

  if (opts?.forceRefresh) {
    return fetchAndStore(uniqueTickers, provider);
  }

  const cached = await prismaService.quoteCache.findMany({ where: { ticker: { in: uniqueTickers } } });

  const freshCutoff = Date.now() - QUOTE_CACHE_FRESHNESS_MS;
  const result = new Map<string, Quote>();
  const staleRows: typeof cached = [];
  const missingTickers: string[] = [];

  const cachedByTicker = new Map(cached.map((row) => [row.ticker, row]));
  for (const ticker of uniqueTickers) {
    const row = cachedByTicker.get(ticker);
    if (!row) {
      missingTickers.push(ticker);
      continue;
    }
    result.set(ticker, toQuote(row));
    if (row.retrievedAt.getTime() < freshCutoff) staleRows.push(row);
  }

  const blocking = missingTickers.slice(0, MAX_BLOCKING_LIVE_FETCHES);
  const deferred = [
    ...staleRows.sort((a, b) => a.retrievedAt.getTime() - b.retrievedAt.getTime()).map((row) => row.ticker),
    ...missingTickers.slice(MAX_BLOCKING_LIVE_FETCHES),
  ];

  if (blocking.length > 0) {
    for (const [ticker, quote] of await fetchAndStore(blocking, provider)) result.set(ticker, quote);
  }
  if (deferred.length > 0) refreshInBackground(deferred, provider);

  return result;
}
