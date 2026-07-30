import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/shared/components/page-header";
import { EmptyState } from "@/shared/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SignalTabs } from "@/features/signal-convergence/components/signal-tabs";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default async function CongressionalTradesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const events = await prisma.congressionalTransactionEvent.findMany({
    orderBy: { transactionDate: "desc" },
    take: 100,
    include: { resolvedCompany: { select: { ticker: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="Congressional Periodic Transaction Report disclosures across tracked companies."
      />
      <SignalTabs />

      {events.length === 0 ? (
        <EmptyState
          title="No congressional data yet"
          description="Congressional disclosures are not fetched automatically (House/Senate have no stable public API — see Methodology). Import a real CSV, or load the sample fixture, to populate this view."
        />
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {e.transactionDate.toISOString().slice(0, 10)}
                    </span>
                    <Badge variant={e.transactionType === "PURCHASE" ? "default" : "secondary"}>
                      {e.transactionType}
                    </Badge>
                    {e.resolvedCompany ? (
                      <span className="text-sm font-medium">{e.resolvedCompany.ticker}</span>
                    ) : null}
                    {!e.isLiveOfficialSource ? (
                      <Badge variant="outline" title="Not a live official disclosure feed">
                        {e.sourceName === "sample_fixture" ? "Sample data" : "Manually imported"}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="text-muted-foreground text-xs">
                    Disclosed {e.disclosureDelayDays} day{e.disclosureDelayDays === 1 ? "" : "s"} after the
                    trade
                  </span>
                </div>
                <p className="text-sm">
                  <span className="font-medium">{e.politicianName}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    ({e.chamber === "HOUSE" ? "House" : "Senate"}
                    {e.state ? `, ${e.state}` : ""}
                    {e.party ? `, ${e.party}` : ""}) — {e.owner.toLowerCase()}
                  </span>
                </p>
                <p className="text-sm">Asset disclosed: {e.assetNameDisclosed}</p>
                <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                  {e.reportedRangeMin && e.reportedRangeMax ? (
                    <span>
                      Reported range: {compactCurrency.format(Number(e.reportedRangeMin))} –{" "}
                      {compactCurrency.format(Number(e.reportedRangeMax))}
                    </span>
                  ) : null}
                  {e.estimatedRangeMidpoint ? (
                    <span>
                      Estimated midpoint: {compactCurrency.format(Number(e.estimatedRangeMidpoint))}
                    </span>
                  ) : null}
                  {e.filingUrl ? (
                    <a
                      href={e.filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Filing ↗
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
