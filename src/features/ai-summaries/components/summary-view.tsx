import { SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { FilingSummaryContent } from "@/features/ai-summaries/lib/filing-summary-schema";

/** Shared by FilingSummaryPanel and FinancialsSummaryPanel — same structured shape, different subject. */
export function SummaryView({
  summary,
  model,
  verifyAgainstLabel,
}: {
  summary: FilingSummaryContent;
  model: string;
  verifyAgainstLabel: string;
}) {
  return (
    <div className="bg-muted/40 mt-3 space-y-3 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <SparklesIcon className="size-3" /> AI-generated — may contain errors, verify against{" "}
          {verifyAgainstLabel}
        </span>
        <Badge variant="outline">{model}</Badge>
      </div>
      <p>{summary.plainEnglishSummary}</p>
      {summary.keyFacts.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Key facts</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {summary.keyFacts.map((fact, i) => (
              <li key={i}>{fact}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.notableItems.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Notable items</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {summary.notableItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.risksOrConcerns.length > 0 ? (
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Risks / concerns
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {summary.risksOrConcerns.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {summary.uncertainty ? (
        <p className="text-muted-foreground text-xs italic">Uncertain: {summary.uncertainty}</p>
      ) : null}
    </div>
  );
}
