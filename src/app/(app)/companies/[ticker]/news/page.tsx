import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getNewsForCompany } from "@/features/news/server/queries";
import { NewsList } from "@/features/news/components/news-list";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyNewsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const news = await getNewsForCompany(ticker);

  if (news.length === 0) {
    return (
      <EmptyState
        title="No recent news"
        description="Either nothing has been published in the last two weeks, or no market-data provider is configured yet."
      />
    );
  }

  return <NewsList items={news} />;
}
