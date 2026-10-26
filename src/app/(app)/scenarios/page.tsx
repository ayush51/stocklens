import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getScenarioPositionsForUser } from "@/features/scenario-analysis/server/queries";
import { PositionScenarioTable } from "@/features/scenario-analysis/components/position-scenario-table";
import { PortfolioScenarioTool } from "@/features/scenario-analysis/components/portfolio-scenario-tool";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Scenarios" };

export default async function ScenariosPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { positions, excludedTickers } = await getScenarioPositionsForUser(user.id);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scenario analysis"
        description="Hypothetical price moves applied to your actual positions — not a forecast, not a prediction of what will happen, just the math of what a given move would mean."
      />

      {excludedTickers.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">No live quote, excluded from scenarios:</span>
          {excludedTickers.map((ticker) => (
            <Badge key={ticker} variant="outline">
              {ticker}
            </Badge>
          ))}
        </div>
      ) : null}

      {positions.length === 0 ? (
        <EmptyState
          title="No positions with a live quote"
          description="Scenario analysis needs current prices to work from. This shows up empty until a market-data provider is configured (see FINNHUB_API_KEY) — nothing here is fabricated in the meantime."
        />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Portfolio scenario</CardTitle>
            </CardHeader>
            <CardContent>
              <PortfolioScenarioTool positions={positions} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Position scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <PositionScenarioTable positions={positions} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
