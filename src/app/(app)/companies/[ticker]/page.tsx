import Link from "next/link";

import { getOrResolveCompanyByTicker, normalizeTicker } from "@/features/companies/server/queries";
import { getFinancialStatementsForCompany } from "@/features/financial-metrics/server/queries";
import { getFilingsForCompany } from "@/features/filings/server/queries";
import { MetricsTable } from "@/features/financial-metrics/components/metrics-table";
import { FilingsList } from "@/features/filings/components/filings-list";
import { EmptyState } from "@/shared/components/empty-state";

export default async function CompanyOverviewPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: rawTicker } = await params;
  const ticker = normalizeTicker(rawTicker);
  const company = await getOrResolveCompanyByTicker(ticker);
  if (!company) return null; // layout already rendered the not-found state

  const [statements, filings] = await Promise.all([
    getFinancialStatementsForCompany(company.id, company.cik),
    getFilingsForCompany(company.id, company.cik),
  ]);

  return (
    <div className="space-y-8">
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
        {filings.length > 0 ? (
          <FilingsList filings={filings.slice(0, 3)} />
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
