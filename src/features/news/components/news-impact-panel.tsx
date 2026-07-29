"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { classifyNewsImpact } from "@/features/news/server/actions";
import type { NewsImpactContent } from "@/features/news/lib/news-impact-schema";

const RELEVANCE_LABEL: Record<string, string> = {
  POTENTIALLY_MATERIAL: "Potentially material",
  WORTH_MONITORING: "Worth monitoring",
  LOW_RELEVANCE: "Low relevance",
  DUPLICATE_OR_KNOWN: "Duplicate / already known",
  INSUFFICIENT_INFORMATION: "Insufficient information",
};

const RELEVANCE_VARIANT: Record<string, "default" | "outline" | "destructive"> = {
  POTENTIALLY_MATERIAL: "destructive",
  WORTH_MONITORING: "default",
  LOW_RELEVANCE: "outline",
  DUPLICATE_OR_KNOWN: "outline",
  INSUFFICIENT_INFORMATION: "outline",
};

export function NewsImpactPanel({
  companyId,
  ticker,
  companyName,
  headline,
  summary,
}: {
  companyId: string;
  ticker: string;
  companyName: string;
  headline: string;
  summary: string;
}) {
  const [result, setResult] = useState<NewsImpactContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClassify() {
    setLoading(true);
    setError(null);
    try {
      const classification = await classifyNewsImpact(companyId, headline, summary, ticker, companyName);
      setResult(classification);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not classify this article.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="bg-muted/40 mt-2 space-y-1.5 rounded-md border p-2.5 text-sm">
        <div className="flex items-center gap-2">
          <Badge variant={RELEVANCE_VARIANT[result.relevance] ?? "outline"}>
            {RELEVANCE_LABEL[result.relevance] ?? result.relevance}
          </Badge>
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <SparklesIcon className="size-3" /> based on headline/summary only, not the full article
          </span>
        </div>
        <p className="text-muted-foreground">{result.reasoning}</p>
      </div>
    );
  }

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClassify}
        disabled={loading}
        className="mt-1 h-7 px-2 text-xs"
      >
        <SparklesIcon className="size-3" /> {loading ? "Assessing…" : "Why does this matter?"}
      </Button>
      {error ? <p className="text-destructive mt-1 text-xs">{error}</p> : null}
    </div>
  );
}
