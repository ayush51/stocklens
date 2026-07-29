"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateFinancialsSummary } from "@/features/ai-summaries/server/actions";
import { SummaryView } from "@/features/ai-summaries/components/summary-view";
import type { FilingSummaryContent } from "@/features/ai-summaries/lib/filing-summary-schema";

export function FinancialsSummaryPanel({
  companyId,
  initialSummary,
}: {
  companyId: string;
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
      const result = await generateFinancialsSummary(companyId);
      if (!result) {
        setError("Not enough reported financial data to summarize yet.");
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
          {expanded ? "Hide" : "Show"} AI summary of financials
        </Button>
        {expanded ? (
          <SummaryView
            summary={state.summary}
            model={state.model}
            verifyAgainstLabel="the reported statements below"
          />
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleGenerate} disabled={loading}>
        <SparklesIcon className="size-3.5" /> {loading ? "Summarizing…" : "Summarize financials with AI"}
      </Button>
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
