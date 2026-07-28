import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Prisma } from "@/generated/prisma/client";

type EntryWithCompany = Prisma.DecisionJournalEntryGetPayload<{ include: { company: true } }>;

export function DecisionEntryList({ entries }: { entries: EntryWithCompany[] }) {
  return (
    <div className="space-y-3">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Link href={`/companies/${entry.company.ticker}`} className="font-medium hover:underline">
                  {entry.company.ticker}
                </Link>
                <Badge variant="outline">{entry.action}</Badge>
                {entry.currentEmotion ? <Badge variant="secondary">{entry.currentEmotion}</Badge> : null}
              </div>
              {entry.evidenceSupporting ? (
                <p className="text-muted-foreground mt-1 text-sm">{entry.evidenceSupporting}</p>
              ) : null}
              {entry.finalAction ? (
                <p className="mt-1 text-xs">
                  Final action: {entry.finalAction}
                  {entry.outcomeNotes ? ` — ${entry.outcomeNotes}` : ""}
                </p>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs whitespace-nowrap">
              {entry.decisionDate.toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
