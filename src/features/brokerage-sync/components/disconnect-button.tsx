"use client";

import { useTransition } from "react";

import { disconnectRobinhood } from "@/features/brokerage-sync/server/actions";
import { Button } from "@/components/ui/button";

export function DisconnectButton({ portfolioId }: { portfolioId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={() => startTransition(() => disconnectRobinhood(portfolioId))}
    >
      {isPending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
