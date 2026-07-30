import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { getDataHealthSnapshot } from "@/features/signal-convergence/server/data-health";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalTabs } from "@/features/signal-convergence/components/signal-tabs";
import { ResolutionReviewList } from "@/features/signal-convergence/components/resolution-review-list";

const SOURCE_LABEL: Record<string, string> = {
  SEC_INSIDER: "SEC EDGAR — Insider Transactions",
  USASPENDING: "USAspending — Government Contracts",
  CONGRESS: "Congressional Disclosures",
};

const PROVIDER_KIND_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  official: { label: "Official source", variant: "default" },
  manual_import: { label: "Manually imported", variant: "secondary" },
  sample_fixture: { label: "Sample data — not live", variant: "outline" },
};

export default async function DataHealthPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [health, pendingReviews] = await Promise.all([
    getDataHealthSnapshot(),
    prisma.entityResolutionReview.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { suggestedCompany: { select: { ticker: true, name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Signal Convergence"
        description="Ingestion health per source, and unresolved entity mappings."
      />
      <SignalTabs />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((h) => {
          const kind = PROVIDER_KIND_LABEL[h.providerKind];
          return (
            <Card key={h.source}>
              <CardHeader className="space-y-1">
                <CardTitle className="text-base">{SOURCE_LABEL[h.source] ?? h.source}</CardTitle>
                <Badge variant={kind.variant} className="w-fit">
                  {kind.label}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  {h.isStale ? (
                    <Badge variant="destructive">Stale</Badge>
                  ) : (
                    <Badge variant="default">Current</Badge>
                  )}
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last successful run</span>
                  <span>
                    {h.lastSuccessfulRun ? h.lastSuccessfulRun.completedAt.toLocaleString() : "Never"}
                  </span>
                </div>
                {h.lastSuccessfulRun ? (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Records (fetched / inserted)</span>
                    <span className="tabular-nums">
                      {h.lastSuccessfulRun.recordsFetched} / {h.lastSuccessfulRun.recordsInserted}
                    </span>
                  </div>
                ) : null}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last attempted run</span>
                  <span>{h.lastAttemptedRun ? h.lastAttemptedRun.startedAt.toLocaleString() : "Never"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Errors (7d)</span>
                  <span className="tabular-nums">{h.recentErrorCount}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Unresolved entity mappings ({pendingReviews.length})</h2>
        <p className="text-muted-foreground text-sm">
          A raw recipient or asset name that didn&apos;t resolve to a public company with enough confidence to
          auto-link. Confirm or reject each — confirming also teaches the system this name for future runs.
        </p>
        <ResolutionReviewList
          reviews={pendingReviews.map((r) => ({
            id: r.id,
            sourceType: r.sourceType,
            rawName: r.rawName,
            suggestedCompanyId: r.suggestedCompanyId,
            suggestedCompany: r.suggestedCompany
              ? { ticker: r.suggestedCompany.ticker, name: r.suggestedCompany.name }
              : null,
            suggestedConfidence: r.suggestedConfidence ? Number(r.suggestedConfidence) : null,
          }))}
        />
      </div>
    </div>
  );
}
