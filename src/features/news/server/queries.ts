import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import type { NewsItem } from "@/shared/contracts/market-data-provider";

/**
 * Real news for one company, from the live market-data provider — no
 * persistence, no fabrication. Empty when no provider is configured (see
 * the unavailable fallback in get-provider.ts) or the vendor has nothing
 * for this ticker in the window.
 */
export async function getNewsForCompany(ticker: string, lookbackDays = 14): Promise<NewsItem[]> {
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const provider = getMarketDataProvider();
  const news = await provider.getCompanyNews(ticker, from, to);

  return news.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
