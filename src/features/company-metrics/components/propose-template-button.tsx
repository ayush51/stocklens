"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SparklesIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { proposeKpiTemplate } from "@/features/company-metrics/server/actions";

export function ProposeTemplateButton({
  companyId,
  ticker,
  companyName,
  sector,
  industry,
}: {
  companyId: string;
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePropose() {
    setLoading(true);
    setError(null);
    try {
      await proposeKpiTemplate(companyId, ticker, companyName, sector, industry);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not propose a KPI template.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="outline" onClick={handlePropose} disabled={loading}>
        <SparklesIcon className="size-3.5" /> {loading ? "Proposing…" : "Propose a KPI template with AI"}
      </Button>
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        Based on general knowledge of this company/industry, not a specific filing — you&apos;ll be able to
        confirm each metric against a real source afterward.
      </p>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
