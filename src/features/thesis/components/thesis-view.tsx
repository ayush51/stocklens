import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { THESIS_TEXT_FIELDS } from "@/features/thesis/validation/thesis";
import { diffThesisVersions, type DiffableThesis } from "@/features/thesis/lib/diff-thesis";
import type { Prisma } from "@/generated/prisma/client";

type ThesisWithRevisions = Prisma.ThesisGetPayload<{ include: { revisions: true } }>;

const STATUS_LABEL: Record<
  string,
  { text: string; variant: "default" | "outline" | "destructive" | "secondary" }
> = {
  UNREVIEWED: { text: "Unreviewed", variant: "outline" },
  ON_TRACK: { text: "On track", variant: "default" },
  WATCH: { text: "Watch", variant: "secondary" },
  WEAKENED: { text: "Weakened", variant: "destructive" },
  BROKEN: { text: "Broken", variant: "destructive" },
  EXITED: { text: "Exited", variant: "outline" },
};

function toDiffable(
  entity: { targetPrice: { toString(): string } | null } & Omit<DiffableThesis, "targetPrice">,
): DiffableThesis {
  return { ...entity, targetPrice: entity.targetPrice?.toString() ?? null };
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm">{value}</p>
    </div>
  );
}

export function ThesisView({ thesis, ticker }: { thesis: ThesisWithRevisions; ticker: string }) {
  // revisions are ordered newest-first by the query; walk oldest->newest to
  // diff each snapshot against the one that superseded it (or the current
  // thesis, for the most recent revision).
  const chronological = [...thesis.revisions].reverse();
  const timeline = chronological.map((revision, index) => {
    const next = chronological[index + 1] ?? thesis;
    return { revision, changedFields: diffThesisVersions(toDiffable(revision), toDiffable(next)) };
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-xl">{thesis.title}</CardTitle>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={STATUS_LABEL[thesis.status]?.variant ?? "outline"}>
                  {STATUS_LABEL[thesis.status]?.text ?? thesis.status}
                </Badge>
                <Badge variant="secondary">Conviction: {thesis.conviction}</Badge>
                {thesis.targetPrice ? (
                  <Badge variant="secondary">Target: ${thesis.targetPrice.toString()}</Badge>
                ) : null}
                {thesis.nextReviewDate ? (
                  <Badge variant="outline">Next review: {thesis.nextReviewDate.toLocaleDateString()}</Badge>
                ) : null}
              </div>
            </div>
            <Button variant="outline" size="sm" render={<Link href={`/companies/${ticker}/thesis/edit`} />}>
              Edit thesis
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Summary" value={thesis.summary} />
          {THESIS_TEXT_FIELDS.filter((f) => f.key !== "title" && f.key !== "summary").map((field) => (
            <Field key={field.key} label={field.label} value={thesis[field.key]} />
          ))}
          {thesis.sources.length > 0 ? (
            <div>
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Sources</p>
              <ul className="mt-1 list-inside list-disc text-sm">
                {thesis.sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-muted-foreground text-xs">
            Created {thesis.createdAt.toLocaleDateString()} · Last updated{" "}
            {thesis.updatedAt.toLocaleDateString()}
          </p>
        </CardContent>
      </Card>

      {thesis.revisions.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline
              .slice()
              .reverse()
              .map(({ revision, changedFields }) => (
                <div key={revision.id} className="border-border border-l-2 pl-4">
                  <p className="text-sm font-medium">{revision.createdAt.toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs">
                    {changedFields.length > 0
                      ? `Changed before the next edit: ${changedFields.join(", ")}`
                      : "No tracked fields changed before the next edit"}
                  </p>
                </div>
              ))}
            <div className="border-border border-l-2 pl-4">
              <p className="text-sm font-medium">{thesis.updatedAt.toLocaleString()} (current)</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
