import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getPortfoliosForUser } from "@/features/portfolios/server/queries";
import { HoldingsTable } from "@/features/portfolios/components/holdings-table";
import { PortfolioSummaryCard } from "@/features/portfolios/components/portfolio-summary";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortfoliosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const portfolios = await getPortfoliosForUser(user.id);
  const hasAnyHoldings = portfolios.some((p) => p.stocks.length > 0 || p.etfs.length > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolios"
        description="Holdings synced from your Robinhood account via an MCP-connected chat session — never automatic, never stores your credentials."
      />

      {!hasAnyHoldings ? (
        <EmptyState
          title="No holdings yet"
          description={
            'Ask Claude, in a session with the robinhood-trading MCP connected, to "sync my portfolio" to pull in your current positions.'
          }
        />
      ) : (
        portfolios.map((portfolio) => (
          <div key={portfolio.id} className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{portfolio.name}</h2>
              {portfolio.lastSyncedAt ? (
                <p className="text-muted-foreground text-sm">
                  Last synced {portfolio.lastSyncedAt.toLocaleString()}
                </p>
              ) : null}
            </div>

            <PortfolioSummaryCard portfolio={portfolio} />

            {portfolio.stocks.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Stocks</CardTitle>
                </CardHeader>
                <CardContent>
                  <HoldingsTable rows={portfolio.stocks} />
                </CardContent>
              </Card>
            ) : null}

            {portfolio.etfs.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>ETFs & funds</CardTitle>
                </CardHeader>
                <CardContent>
                  <HoldingsTable rows={portfolio.etfs} />
                </CardContent>
              </Card>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
