"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRingIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { checkAlertsNow } from "@/features/alerts/server/actions";
import type { AlertEvaluation } from "@/features/alerts/server/evaluate";

export function CheckNowButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AlertEvaluation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheck() {
    setLoading(true);
    setError(null);
    try {
      const evaluations = await checkAlertsNow();
      setResults(evaluations);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check alerts.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button onClick={handleCheck} disabled={loading}>
          <BellRingIcon className="size-4" /> {loading ? "Checking…" : "Check alerts now"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Checks against live data right now — rules also get an automatic daily check on weekday market
          close, so this is for whenever you don&apos;t want to wait for that.
        </p>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {results ? (
        <div className="space-y-1.5">
          {results.map((r) => (
            <div key={r.ruleId} className="flex items-center gap-2 text-sm">
              <Badge variant={r.triggered ? "destructive" : "outline"}>
                {r.triggered ? "Triggered" : "OK"}
              </Badge>
              <span className={r.message ? "" : "text-muted-foreground italic"}>
                {r.message ?? `${r.ticker ?? "rule"} — could not evaluate right now`}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
