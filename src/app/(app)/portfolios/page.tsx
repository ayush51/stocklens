import { redirect } from "next/navigation";
import { Briefcase, RefreshCw } from "lucide-react";

import { getCurrentUser } from "@/lib/auth/session";
import { getPortfoliosForUser } from "@/features/portfolios/server/queries";
import { HoldingsTable } from "@/features/portfolios/components/holdings-table";
import { PortfolioSummaryCard } from "@/features/portfolios/components/portfolio-summary";
import { AllocationChart } from "@/features/portfolios/components/allocation-chart";
import { CreatePortfolioDialog } from "@/features/portfolios/components/create-portfolio-dialog";
import { AddTransactionDialog } from "@/features/portfolios/components/add-transaction-dialog";
import { RefreshQuotesButton } from "@/features/portfolios/components/refresh-quotes-button";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "Portfolios" };

export default async function PortfoliosPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in");
  }

  const portfolios = await getPortfoliosForUser(user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Portfolios"
        description="Robinhood holdings come in via an MCP-connected chat session sync — never automatic, never stores your credentials. Other accounts can be tracked by adding a portfolio and entering transactions manually."
        actions={
          <>
            <RefreshQuotesButton />
            <CreatePortfolioDialog />
          </>
        }
      />

      {portfolios.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No portfolios yet"
          description={
            'Create one manually above, or ask Claude, in a session with the robinhood-trading MCP connected, to "sync my portfolio" to pull in your current Robinhood positions.'
          }
        />
      ) : (
        portfolios.map((portfolio) => (
          <div key={portfolio.id} className="space-y-6">
            <div className="flex items-baseline justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">{portfolio.name}</h2>
                {portfolio.source === "MANUAL" ? <AddTransactionDialog portfolioId={portfolio.id} /> : null}
              </div>
              {portfolio.lastSyncedAt ? (
                <p className="text-muted-foreground text-sm">
                  Portfolio data was last synchronized through a read-only Robinhood MCP session at{" "}
                  {portfolio.lastSyncedAt.toLocaleString()}.
                </p>
              ) : null}
            </div>

            {portfolio.stocks.length === 0 && portfolio.etfs.length === 0 ? (
              <EmptyState
                icon={portfolio.source === "MANUAL" ? Briefcase : RefreshCw}
                title="No transactions yet"
                description={
                  portfolio.source === "MANUAL"
                    ? "Add a transaction above to start tracking this portfolio."
                    : "Sync your Robinhood positions to populate this portfolio."
                }
              />
            ) : (
              <>
                <PortfolioSummaryCard portfolio={portfolio} />
                <AllocationChart holdings={[...portfolio.stocks, ...portfolio.etfs]} />

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
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
}
