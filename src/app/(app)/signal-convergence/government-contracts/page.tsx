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

const RECORD_TYPE_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  NEW_AWARD: "default",
  MODIFICATION: "secondary",
  DE_OBLIGATION: "destructive",
  CORRECTION: "outline",
};

export default async function GovernmentContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const events = await prisma.governmentContractEvent.findMany({
    orderBy: { actionDate: "desc" },
    take: 100,
    include: { resolvedCompany: { select: { ticker: true, name: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="Recent federal contract actions across tracked companies."
      />
      <SignalTabs />

      {events.length === 0 ? (
        <EmptyState
          title="No contract events yet"
          description="Trigger a refresh from the Overview tab to fetch real USAspending data."
        />
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <Card key={e.id}>
              <CardContent className="space-y-1 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{e.actionDate.toISOString().slice(0, 10)}</span>
                    <Badge variant={RECORD_TYPE_VARIANT[e.recordType] ?? "outline"}>
                      {e.recordType.replace("_", " ")}
                    </Badge>
                    {e.resolvedCompany ? (
                      <span className="text-sm font-medium">{e.resolvedCompany.ticker}</span>
                    ) : (
                      <Badge variant="outline" title="No confident public-company mapping">
                        Unresolved
                      </Badge>
                    )}
                  </div>
                  <span className="text-muted-foreground text-xs">{e.awardingAgency}</span>
                </div>
                <p className="text-sm">
                  Contract recipient: <span className="font-medium">{e.recipientLegalName}</span>
                  {e.resolvedCompany ? (
                    <span className="text-muted-foreground">
                      {" "}
                      — public parent association: {e.resolvedCompany.ticker}
                    </span>
                  ) : null}
                </p>
                {e.description ? (
                  <p className="text-muted-foreground line-clamp-2 text-xs">{e.description}</p>
                ) : null}
                <div className="text-muted-foreground flex gap-4 text-xs">
                  {e.newlyObligatedAmount !== null ? (
                    <span>Newly obligated: {compactCurrency.format(Number(e.newlyObligatedAmount))}</span>
                  ) : null}
                  {e.currentAwardAmount !== null ? (
                    <span>Current award total: {compactCurrency.format(Number(e.currentAwardAmount))}</span>
                  ) : null}
                  {e.sourceUrl ? (
                    <a
                      href={e.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Source ↗
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
