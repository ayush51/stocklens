import { describe, it, expect } from "vitest";

import { robinhoodBrokerageSyncProvider } from "@/features/brokerage-sync/providers/robinhood";
import type { BrokerageSyncProvider } from "@/shared/contracts/brokerage-sync-provider";

/**
 * Phase 2 acceptance criterion (docs/phase-0/09-security-model.md §3.1):
 * a test asserting the read-only allowlist, not just the interface's types.
 *
 * TypeScript interfaces are erased at compile time — there's nothing to
 * reflect on at runtime for BrokerageSyncProvider itself. What this test
 * actually verifies is the CONCRETE object every caller uses: exactly the
 * three read methods, nothing else, on the real Robinhood adapter. If
 * someone adds a fourth method to the adapter — a write method or
 * otherwise — this fails even if they never touch the interface file.
 */
describe("BrokerageSyncProvider read-only allowlist", () => {
  const EXPECTED_METHODS = ["getAccountSummary", "listPositions", "listTransactions"] as const;

  it("the Robinhood adapter exposes exactly the allowed read methods, nothing else", () => {
    const actualMethods = Object.keys(robinhoodBrokerageSyncProvider).sort();
    expect(actualMethods).toEqual([...EXPECTED_METHODS].sort());
  });

  it("none of the exposed methods are named or shaped like a write operation", () => {
    const suspiciousNamePattern = /place|cancel|exercise|transfer|withdraw|deposit|modify|update|delete|close/i;
    for (const methodName of Object.keys(robinhoodBrokerageSyncProvider)) {
      expect(methodName).not.toMatch(suspiciousNamePattern);
    }
  });
});

// Compile-time companion to the runtime check above: this only type-checks
// (and therefore only passes `npm run typecheck` / `vitest run`, which
// type-checks via esbuild) if BrokerageSyncProvider has exactly these three
// members — keyof T extends the allowed union AND the union extends keyof T
// catches both "extra member added" and "member removed."
type AllowedMembers = "getAccountSummary" | "listPositions" | "listTransactions";
type ExactlyAllowed<T> = keyof T extends AllowedMembers ? (AllowedMembers extends keyof T ? true : false) : false;
const _interfaceShapeUnchanged: ExactlyAllowed<BrokerageSyncProvider> = true;
void _interfaceShapeUnchanged;
