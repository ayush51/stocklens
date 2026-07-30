import { env } from "@/lib/env";
import type { MarketDataProvider } from "@/shared/contracts/market-data-provider";
import { createFinnhubMarketDataProvider } from "@/features/market-data/providers/finnhub";
import { unavailableMarketDataProvider } from "@/features/market-data/providers/unavailable";

/**
 * Single entry point feature code should use to reach market data — never
 * import a concrete provider directly. Returns the fail-closed unavailable
 * provider when FINNHUB_API_KEY isn't configured OR when
 * MARKET_DATA_PROVIDER_ENABLED has been flipped off as an incident kill
 * switch, so the rest of the app degrades to an "unavailable" UI state
 * instead of crashing either way.
 */
export function getMarketDataProvider(): MarketDataProvider {
  if (!env.FINNHUB_API_KEY || !env.MARKET_DATA_PROVIDER_ENABLED) {
    return unavailableMarketDataProvider;
  }
  return createFinnhubMarketDataProvider(env.FINNHUB_API_KEY, {
    yahooHistoricalsFallbackEnabled: env.YAHOO_HISTORICALS_FALLBACK_ENABLED,
  });
}
