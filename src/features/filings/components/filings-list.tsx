import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { FilingSummaryPanel } from "@/features/ai-summaries/components/filing-summary-panel";
import type { FilingSummaryContent } from "@/features/ai-summaries/lib/filing-summary-schema";

interface FilingRow {
  id: string;
  formType: string;
  filedAt: Date;
  periodOfReport: Date | null;
  documentUrl: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function FilingsList({
  filings,
  summaries,
}: {
  filings: FilingRow[];
  summaries: Map<string, { summary: FilingSummaryContent; model: string }>;
}) {
  return (
    <ul className="divide-border divide-y">
      {filings.map((filing) => (
        <li key={filing.id} className="py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{filing.formType}</Badge>
              <span className="text-sm">
                Filed {dateFormatter.format(filing.filedAt)}
                {filing.periodOfReport
                  ? ` · for period ${dateFormatter.format(filing.periodOfReport)}`
                  : null}
              </span>
            </div>
            {/*
              Filing content is untrusted external HTML — link out to SEC.gov
              rather than fetching/embedding it. See
              docs/phase-0/09-security-model.md §5.
            */}
            <a
              href={filing.documentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              View on SEC.gov <ExternalLink className="size-3.5" />
            </a>
          </div>
          <div className="mt-2">
            <FilingSummaryPanel filingId={filing.id} initialSummary={summaries.get(filing.id) ?? null} />
          </div>
        </li>
      ))}
    </ul>
  );
}
