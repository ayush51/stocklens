import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { getCurrentUser } from "@/lib/auth/session";
import { getCompanySignalDetail, type SignalWindow } from "@/features/signal-convergence/server/queries";
import { PageHeader } from "@/shared/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignalConvergenceDisclaimer } from "@/features/signal-convergence/components/disclaimer-banner";

const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

function parseWindow(value: string | undefined): SignalWindow {
  const n = Number(value);
  return n === 7 || n === 90 ? n : 30;
}

export default async function CompanySignalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { ticker } = await params;
  const { window: windowParam } = await searchParams;
  const window = parseWindow(windowParam);

  const detail = await getCompanySignalDetail(ticker, window);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.ticker} — ${detail.name}`}
        description="Signal Convergence detail"
        actions={
          <Link href="/signal-convergence" className="text-primary text-sm underline">
            ← Back to Overview
          </Link>
        }
      />

      <SignalConvergenceDisclaimer />

      <Card>
        <CardHeader>
          <CardTitle>Evidence Score breakdown ({window}-day window)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold tabular-nums">{detail.score.totalScore}</span>
            <span className="text-muted-foreground text-sm">/ 100</span>
            <Badge variant="outline">{Math.round(detail.score.confidence * 100)}% confidence</Badge>
            <Badge variant="outline">{detail.score.categoriesMatched}/3 categories</Badge>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground text-xs">Insider</p>
              <p className="font-semibold tabular-nums">{detail.score.components.insider} / 35</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Government contracts</p>
              <p className="font-semibold tabular-nums">{detail.score.components.governmentContracts} / 30</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Congress</p>
              <p className="font-semibold tabular-nums">{detail.score.components.congress} / 20</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Convergence bonus</p>
              <p className="font-semibold tabular-nums">{detail.score.components.convergenceBonus} / 15</p>
            </div>
          </div>
          {detail.score.explanations.length > 0 ? (
            <ul className="ml-5 list-disc space-y-1 text-sm">
              {detail.score.explanations.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">No qualifying signals in this window.</p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Insider transactions ({detail.insiderEvents.length})</h2>
        {detail.insiderEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No insider transactions on file for this company.</p>
        ) : (
          <div className="space-y-2">
            {detail.insiderEvents.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.transactionDate.toISOString().slice(0, 10)}</span>
                    <Badge variant="outline">{e.classification.replace(/_/g, " ")}</Badge>
                    <span>{e.reportingPersonName}</span>
                    <span className="text-muted-foreground">
                      ({e.relationshipCategory.replace("_", " ").toLowerCase()})
                    </span>
                  </div>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                    {e.shares ? <span>{Number(e.shares).toLocaleString()} shares</span> : null}
                    {e.estimatedTotalValue ? (
                      <span>≈ {compactCurrency.format(Number(e.estimatedTotalValue))}</span>
                    ) : null}
                    {e.is10b51Plan ? <span>10b5-1 plan</span> : null}
                    {e.isAmendment ? <span>Amendment</span> : null}
                    <a
                      href={e.filingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline"
                    >
                      Filing ↗
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Government contracts ({detail.contractEvents.length})</h2>
        {detail.contractEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No government contract events on file for this company.
          </p>
        ) : (
          <div className="space-y-2">
            {detail.contractEvents.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.actionDate.toISOString().slice(0, 10)}</span>
                    <Badge variant="outline">{e.recordType.replace("_", " ")}</Badge>
                    <span>{e.awardingAgency}</span>
                  </div>
                  <p>
                    Contract recipient: <span className="font-medium">{e.recipientLegalName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      — public parent association: {detail.ticker}
                    </span>
                    {e.resolutionConfidence ? (
                      <span className="text-muted-foreground">
                        {" "}
                        ({Math.round(Number(e.resolutionConfidence) * 100)}% confidence)
                      </span>
                    ) : null}
                  </p>
                  <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
                    {e.newlyObligatedAmount !== null ? (
                      <span>Newly obligated: {compactCurrency.format(Number(e.newlyObligatedAmount))}</span>
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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Congressional trades ({detail.congressEvents.length})</h2>
        {detail.congressEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No congressional trades on file for this company.</p>
        ) : (
          <div className="space-y-2">
            {detail.congressEvents.map((e) => (
              <Card key={e.id}>
                <CardContent className="space-y-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{e.transactionDate.toISOString().slice(0, 10)}</span>
                    <Badge variant={e.transactionType === "PURCHASE" ? "default" : "secondary"}>
                      {e.transactionType}
                    </Badge>
                    <span>{e.politicianName}</span>
                    {!e.isLiveOfficialSource ? <Badge variant="outline">Not live</Badge> : null}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    Disclosed {e.disclosureDelayDays} days after the trade
                    {e.reportedRangeMin && e.reportedRangeMax
                      ? ` — range ${compactCurrency.format(Number(e.reportedRangeMin))}–${compactCurrency.format(Number(e.reportedRangeMax))}`
                      : ""}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
