import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getFinancialStatementsForCompany } from "@/features/financial-metrics/server/queries";
import { getCachedFinancialsSummary } from "@/features/ai-summaries/server/queries";
import { MetricsTable } from "@/features/financial-metrics/components/metrics-table";
import { FinancialsTrendChart } from "@/features/financial-metrics/components/financials-trend-chart";
import { FinancialsSummaryPanel } from "@/features/ai-summaries/components/financials-summary-panel";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyFinancialsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const statements = await getFinancialStatementsForCompany(company.id, company.cik);

  if (statements.length === 0) {
    return (
      <EmptyState
        title="No financial data available"
        description="SEC EDGAR doesn't have XBRL financial data on file for this company yet."
      />
    );
  }

  const summary = await getCachedFinancialsSummary(company.id);

  return (
    <div className="space-y-6">
      <FinancialsSummaryPanel companyId={company.id} initialSummary={summary} />
      <FinancialsTrendChart statements={statements} />
      <MetricsTable statements={statements} />
    </div>
  );
}
