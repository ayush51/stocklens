import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { CompanyHeader } from "@/features/companies/components/company-header";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);

  if (!company) {
    // Deliberately not Next's notFound() — this is user-typed input, not a
    // broken link, so it renders inline rather than a hard 404. See
    // docs/phase-0/06-routes.md §4.
    return (
      <EmptyState
        title={`We couldn't find "${ticker}"`}
        description="Check the ticker and try again — this looks up any US-listed company via SEC EDGAR, not just ones you hold."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CompanyHeader company={company} />
      <EmptyState
        title="Financials and filings land here in the next feature pass"
        description="This page currently only resolves and stores the company record itself — financial-metrics and filings are separate, upcoming features."
      />
    </div>
  );
}
