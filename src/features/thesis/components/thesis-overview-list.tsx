import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ThesisOverviewRow } from "@/features/thesis/server/queries";

const STATUS_LABEL: Record<string, string> = {
  UNREVIEWED: "Unreviewed",
  ON_TRACK: "On track",
  WATCH: "Watch",
  WEAKENED: "Weakened",
  BROKEN: "Broken",
  EXITED: "Exited",
};

function dateOrNull(date: Date | null) {
  return date ? new Date(date).toLocaleDateString() : null;
}

export function ThesisOverviewList({ rows }: { rows: ThesisOverviewRow[] }) {
  const withoutThesis = rows.filter((r) => !r.hasThesis);
  const withThesis = rows.filter((r) => r.hasThesis);

  return (
    <div className="space-y-6">
      {withoutThesis.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">
            No thesis yet ({withoutThesis.length}) — sorted by allocation, largest first
          </h2>
          <div className="space-y-2">
            {withoutThesis.map((row) => (
              <Card key={row.companyId}>
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{row.ticker}</span>
                    <span className="text-muted-foreground text-sm">{row.name}</span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {Number(row.allocationPct).toFixed(1)}% of portfolio
                    </span>
                    {row.isOverConcentrationThreshold ? (
                      <Badge variant="destructive" title="Above the concentration warning threshold">
                        concentrated
                      </Badge>
                    ) : null}
                  </div>
                  <Link
                    href={`/companies/${row.ticker}/thesis/edit`}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    Write a thesis
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}

      {withThesis.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-muted-foreground text-sm font-medium">Has a thesis ({withThesis.length})</h2>
          <div className="space-y-2">
            {withThesis.map((row) => (
              <Card key={row.companyId}>
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{row.ticker}</span>
                    <span className="text-muted-foreground text-sm">{row.name}</span>
                    <Badge variant="outline">{STATUS_LABEL[row.status ?? ""] ?? row.status}</Badge>
                    <span className="text-muted-foreground text-xs">{row.conviction} conviction</span>
                    {dateOrNull(row.updatedAt) ? (
                      <span className="text-muted-foreground text-xs">
                        updated {dateOrNull(row.updatedAt)}
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={`/companies/${row.ticker}/thesis`}
                    className="text-primary text-sm font-medium hover:underline"
                  >
                    View
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
