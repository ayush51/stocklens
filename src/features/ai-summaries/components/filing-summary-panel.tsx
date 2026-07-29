"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { generateFilingSummary } from "@/features/ai-summaries/server/actions";
import type { FilingSummaryContent } from "@/features/ai-summaries/lib/filing-summary-schema";

function SummaryView({ summary, model }: { summary: FilingSummaryContent; model: string }) {
  return (
    <div className="bg-muted/40 mt-3 space-y-3 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          <SparklesIcon className="size-3" /> AI-generated — may contain errors, verify against the original
          filing
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

export function FilingSummaryPanel({
  filingId,
  initialSummary,
}: {
  filingId: string;
  initialSummary: { summary: FilingSummaryContent; model: string } | null;
}) {
  const [state, setState] = useState(initialSummary);
  const [expanded, setExpanded] = useState(!!initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateFilingSummary(filingId);
      if (!result) {
        setError("Could not generate a summary for this filing.");
        return;
      }
      setState({ summary: result.summary, model: result.model });
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate a summary.");
    } finally {
      setLoading(false);
    }
  }

  if (state) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide" : "Show"} AI summary
        </Button>
        {expanded ? <SummaryView summary={state.summary} model={state.model} /> : null}
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
        <SparklesIcon className="size-3.5" /> {loading ? "Summarizing…" : "Summarize with AI"}
      </Button>
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
