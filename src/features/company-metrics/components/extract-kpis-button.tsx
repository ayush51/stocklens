"use client";

import { useState } from "react";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { extractKpisFromFiling } from "@/features/company-metrics/server/actions";
import type { ExtractKpisResult } from "@/features/company-metrics/server/extract-kpis";

export function ExtractKpisButton({ companyId, ticker }: { companyId: string; ticker: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExtractKpisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExtract() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await extractKpisFromFiling(companyId, ticker);
      if (!res) {
        setError("No filing or financial data available to extract from yet.");
        return;
      }
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not extract KPI values.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-border bg-muted/30 flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          Read real values for these metrics out of the company&apos;s most recent 10-K/10-Q.
        </p>
        <Button variant="outline" size="sm" onClick={handleExtract} disabled={loading}>
          <SparklesIcon className="size-3.5" /> {loading ? "Reading filing…" : "Extract KPI values with AI"}
        </Button>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {result ? (
        <p className="text-muted-foreground text-xs">
          Read {result.filingFormType} filed {result.fiscalPeriod} {result.fiscalYear} — found{" "}
          {result.savedCount} of {result.extracted.length} metrics.{" "}
          {result.extracted
            .filter((m) => !m.found)
            .map((m) => m.label)
            .join(", ") || null}
          {result.extracted.some((m) => !m.found)
            ? ` not discussed in this filing — not guessed, left unrecorded.`
            : null}
        </p>
      ) : null}
    </div>
  );
}
