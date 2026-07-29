import Link from "next/link";

import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getFinancialStatementsForCompany } from "@/features/financial-metrics/server/queries";
import { getFilingsForCompany } from "@/features/filings/server/queries";
import { getRatiosAndRecommendationsForCompany } from "@/features/company-ratios/server/queries";
import { getCachedFilingSummaries } from "@/features/ai-summaries/server/queries";
import { getPriceHistoryForCompany } from "@/features/market-data/server/queries";
import { MetricsTable } from "@/features/financial-metrics/components/metrics-table";
import { FilingsList } from "@/features/filings/components/filings-list";
import { RatiosPanel } from "@/features/company-ratios/components/ratios-panel";
import { AnalystRecommendationWidget } from "@/features/company-ratios/components/analyst-recommendation-widget";
import { PriceHistoryChart } from "@/features/market-data/components/price-history-chart";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyOverviewPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const [statements, filings, { ratios, recommendations }, priceHistory] = await Promise.all([
    getFinancialStatementsForCompany(company.id, company.cik),
    getFilingsForCompany(company.id, company.cik),
    getRatiosAndRecommendationsForCompany(ticker),
    getPriceHistoryForCompany(ticker),
  ]);

  const recentFilings = filings.slice(0, 3);
  const summaries = await getCachedFilingSummaries(recentFilings.map((f) => f.id));

  return (
    <div className="space-y-8">
      <PriceHistoryChart quote={priceHistory.quote} bars={priceHistory.bars} />

      {ratios || recommendations.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {ratios ? <RatiosPanel ratios={ratios} /> : null}
          {recommendations.length > 0 ? (
            <AnalystRecommendationWidget recommendations={recommendations} />
          ) : null}
        </div>
      ) : null}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest financials</h2>
          {statements.length > 0 ? (
            <Link
              href={`/companies/${ticker}/financials`}
              className="text-primary text-sm font-medium hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
        {statements.length > 0 ? (
          <MetricsTable statements={statements.slice(0, 3)} />
        ) : (
          <EmptyState
            title="No financial data available"
            description="SEC EDGAR doesn't have XBRL financial data on file for this company yet."
          />
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent filings</h2>
          {filings.length > 0 ? (
            <Link
              href={`/companies/${ticker}/filings`}
              className="text-primary text-sm font-medium hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>
        {recentFilings.length > 0 ? (
          <FilingsList filings={recentFilings} summaries={summaries} />
        ) : (
          <EmptyState
            title="No filings found"
            description="SEC EDGAR has no filings on file for this company yet."
          />
        )}
      </section>
    </div>
  );
}
