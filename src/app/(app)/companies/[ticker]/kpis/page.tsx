import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getMetricTemplateForCompany } from "@/features/company-metrics/server/queries";
import { KpiList } from "@/features/company-metrics/components/kpi-list";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyKpisPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const template = await getMetricTemplateForCompany(company.id);

  if (!template) {
    return (
      <EmptyState
        title="No KPI template yet"
        description="Company-specific metrics beyond standard financials (like Oracle's RPO or Meta's Daily Active People) aren't curated for this company yet."
      />
    );
  }

  return <KpiList template={template} ticker={ticker} />;
}
