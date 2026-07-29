import { getMarketDataProvider } from "@/features/market-data/server/get-provider";

const SIX_MONTHS_MS = 183 * 24 * 60 * 60 * 1000;

export async function getPriceHistoryForCompany(ticker: string) {
  const provider = getMarketDataProvider();
  const to = new Date();
  const from = new Date(to.getTime() - SIX_MONTHS_MS);

  const [quote, bars] = await Promise.all([
    provider.getQuote(ticker),
    provider.getHistoricalPrices(ticker, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)),
  ]);

  return { quote, bars };
}
