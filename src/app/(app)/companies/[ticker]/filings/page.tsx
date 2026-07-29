import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getFilingsForCompany } from "@/features/filings/server/queries";
import { FilingsList } from "@/features/filings/components/filings-list";
import { getCachedFilingSummaries } from "@/features/ai-summaries/server/queries";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyFilingsPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const filings = await getFilingsForCompany(company.id, company.cik);

  if (filings.length === 0) {
    return (
      <EmptyState
        title="No filings found"
        description="SEC EDGAR has no filings on file for this company yet."
      />
    );
  }

  const summaries = await getCachedFilingSummaries(filings.map((f) => f.id));

  return <FilingsList filings={filings} summaries={summaries} />;
}
