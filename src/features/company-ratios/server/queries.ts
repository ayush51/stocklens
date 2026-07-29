import { getMarketDataProvider } from "@/features/market-data/server/get-provider";

export async function getRatiosAndRecommendationsForCompany(ticker: string) {
  const provider = getMarketDataProvider();
  const [ratios, recommendations] = await Promise.all([
    provider.getFundamentalRatios(ticker),
    provider.getAnalystRecommendations(ticker),
  ]);

  return { ratios, recommendations };
}
