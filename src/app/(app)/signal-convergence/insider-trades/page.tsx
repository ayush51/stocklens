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

const CLASSIFICATION_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  OPEN_MARKET_PURCHASE: "default",
  OPEN_MARKET_SALE: "destructive",
  OPTION_EXERCISE: "outline",
  AWARD_OR_GRANT: "outline",
  GIFT: "outline",
  TAX_WITHHOLDING: "outline",
  AUTOMATIC_OR_PLANNED: "secondary",
  OTHER: "outline",
};

export default async function InsiderTradesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const events = await prisma.insiderTransactionEvent.findMany({
    orderBy: { transactionDate: "desc" },
    take: 100,
    include: { resolvedCompany: { select: { ticker: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="Recent Form 3/4/5 insider transactions across tracked companies."
      />
      <SignalTabs />

      {events.length === 0 ? (
        <EmptyState
          title="No insider events yet"
          description="Trigger a refresh from the Overview tab to fetch real SEC EDGAR data."
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
                    <Badge variant={CLASSIFICATION_VARIANT[e.classification] ?? "outline"}>
                      {e.classification.replace(/_/g, " ")}
                    </Badge>
                    {e.resolvedCompany ? (
                      <span className="text-sm font-medium">{e.resolvedCompany.ticker}</span>
                    ) : null}
                  </div>
                  {e.is10b51Plan ? (
                    <Badge variant="outline" title="Transaction references a Rule 10b5-1 trading plan">
                      10b5-1
                    </Badge>
                  ) : null}
                </div>
                <p className="text-sm">
                  <span className="font-medium">{e.reportingPersonName}</span>
                  {e.reportingPersonTitle ? (
                    <span className="text-muted-foreground"> — {e.reportingPersonTitle}</span>
                  ) : null}
                  <span className="text-muted-foreground">
                    {" "}
                    ({e.relationshipCategory.replace("_", " ").toLowerCase()})
                  </span>
                </p>
                <div className="text-muted-foreground flex flex-wrap gap-4 text-xs">
                  {e.shares ? <span>{Number(e.shares).toLocaleString()} shares</span> : null}
                  {e.estimatedTotalValue ? (
                    <span>≈ {compactCurrency.format(Number(e.estimatedTotalValue))}</span>
                  ) : null}
                  <span>{e.ownershipType === "D" ? "Direct" : "Indirect"} ownership</span>
                  {e.isAmendment ? <span>Amendment</span> : null}
                  <a href={e.filingUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    Filing ↗
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
