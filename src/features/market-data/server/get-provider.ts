import { env } from "@/lib/env";
import type { MarketDataProvider } from "@/shared/contracts/market-data-provider";
import { createFinnhubMarketDataProvider } from "@/features/market-data/providers/finnhub";
import { unavailableMarketDataProvider } from "@/features/market-data/providers/unavailable";

/**
 * Single entry point feature code should use to reach market data — never
 * import a concrete provider directly. Returns the fail-closed unavailable
 * provider when FINNHUB_API_KEY isn't configured, so the rest of the app
 * degrades to an "unavailable" UI state instead of crashing.
 */
export function getMarketDataProvider(): MarketDataProvider {
  if (!env.FINNHUB_API_KEY) {
    return unavailableMarketDataProvider;
  }
  return createFinnhubMarketDataProvider(env.FINNHUB_API_KEY);
}
