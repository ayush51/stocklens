import { describeMarketDataProviderContract } from "@/shared/contracts/market-data-provider.contract";

import { createFakeMarketDataProvider } from "./index";

describeMarketDataProviderContract({
  provider: createFakeMarketDataProvider(),
  validTicker: "AAPL",
  unknownTicker: "ZZZZ_NOT_REAL",
  historicalRange: { from: "2026-07-01", to: "2026-07-31" },
});
