"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { submitRobinhoodConnect, type RobinhoodConnectState } from "@/features/brokerage-sync/server/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: RobinhoodConnectState = { step: "credentials", error: null };

export function RobinhoodConnectForm() {
  const [state, formAction, isPending] = useActionState(submitRobinhoodConnect, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.step === "done") {
      router.refresh();
    }
  }, [state.step, router]);

  if (state.step === "done") {
    return <p className="text-muted-foreground text-sm">Connected. Refreshing…</p>;
  }

  if (state.step === "mfa") {
    return (
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="pendingSecretId" value={state.pendingSecretId} />
        <div className="space-y-2">
          <Label htmlFor="mfaCode">Verification code</Label>
          <p className="text-muted-foreground text-sm">
            Robinhood sent a code {state.mfaType ? `via ${state.mfaType}` : "to your device"}.
          </p>
          <Input id="mfaCode" name="mfaCode" inputMode="numeric" autoComplete="one-time-code" required autoFocus />
        </div>
        {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">Robinhood username</Label>
        <Input id="username" name="username" autoComplete="username" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Robinhood password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <p className="text-muted-foreground text-sm">
        Read-only. StockLens can never place trades, transfer funds, or change account settings — see{" "}
        <a href="/settings/integrations/robinhood" className="underline">
          what this connection can and can&apos;t do
        </a>
        .
      </p>
      {state.error ? <p className="text-destructive text-sm">{state.error}</p> : null}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Connecting…" : "Connect Robinhood"}
      </Button>
    </form>
  );
}
