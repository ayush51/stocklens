import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { CompanyHeader } from "@/features/companies/components/company-header";
import { CompanyTabs } from "@/features/companies/components/company-tabs";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ ticker: string }>;
}) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);

  if (!company) {
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
      <CompanyTabs ticker={ticker} />
      {children}
    </div>
  );
}
