"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCwIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { triggerManualSignalRefresh } from "@/features/signal-convergence/server/actions";

export function RefreshSignalsButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      await triggerManualSignalRefresh();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not refresh signals.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleRefresh} disabled={loading} variant="outline" size="sm">
        <RefreshCwIcon className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Refreshing…" : "Refresh now"}
      </Button>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
