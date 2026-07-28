"use client";

import { useState, useTransition } from "react";

import { syncRobinhoodNow } from "@/features/brokerage-sync/server/sync";
import { Button } from "@/components/ui/button";

export function SyncNowButton({ portfolioId }: { portfolioId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleSync() {
    startTransition(async () => {
      const result = await syncRobinhoodNow(portfolioId);
      setMessage(result.success ? `Synced ${result.rowsSynced ?? 0} transactions.` : (result.error ?? "Sync failed."));
    });
  }

  return (
    <div className="flex items-center gap-3">
      <Button type="button" size="sm" disabled={isPending} onClick={handleSync}>
        {isPending ? "Syncing…" : "Sync now"}
      </Button>
      {message ? <span className="text-muted-foreground text-sm">{message}</span> : null}
    </div>
  );
}
