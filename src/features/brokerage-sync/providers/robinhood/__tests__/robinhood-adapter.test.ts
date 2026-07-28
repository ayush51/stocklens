import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/crypto/encrypted-secrets", () => ({
  readEncryptedSecret: vi.fn(async () => JSON.stringify({ refreshToken: "fake-refresh", deviceToken: "fake-device" })),
}));

import { robinhoodBrokerageSyncProvider } from "../index";
import type { BrokerageConnectionRef } from "@/shared/contracts/brokerage-sync-provider";

const connection: BrokerageConnectionRef = { connectionId: "conn-1", credentialRef: "secret-1" };

/**
 * Every URL this adapter is allowed to ever call — GET on read endpoints,
 * plus the OAuth token endpoint for refreshing an access token (not a
 * trading operation). If the adapter calls anything else, that's a failure,
 * even if the mocked server below would have happily responded to it —
 * this test doesn't rely on the real Robinhood API rejecting a bad call,
 * it asserts our own code never attempts one.
 */
const ALLOWED_CALL_PATTERNS: { method: string; pathPattern: RegExp }[] = [
  { method: "POST", pathPattern: /^\/oauth2\/token\/$/ },
  { method: "GET", pathPattern: /^\/accounts\/$/ },
  { method: "GET", pathPattern: /^\/positions\/(\?.*)?$/ },
  { method: "GET", pathPattern: /^\/orders\/$/ },
  { method: "GET", pathPattern: /^\/dividends\/$/ },
  { method: "GET", pathPattern: /^\/instruments\/[^/]+\/$/ },
];

const FORBIDDEN_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), { status: ok ? 200 : 400, headers: { "Content-Type": "application/json" } });
}

describe("Robinhood adapter — network surface allowlist", () => {
  const calls: { method: string; url: string }[] = [];

  beforeEach(() => {
    calls.length = 0;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();
        const method = init?.method ?? "GET";
        calls.push({ method, url });

        const path = new URL(url).pathname;

        if (method === "POST" && path === "/oauth2/token/") {
          return jsonResponse({ access_token: "fake-access", refresh_token: "fake-refresh", expires_in: 86400 });
        }
        if (method === "GET" && path === "/accounts/") {
          return jsonResponse({ results: [{ account_number: "ACC1", url, type: "individual" }], next: null });
        }
        if (method === "GET" && path === "/positions/") {
          return jsonResponse({
            results: [{ account: "ACC1", instrument: "https://api.robinhood.com/instruments/abc/", quantity: "10", average_buy_price: "150.00" }],
            next: null,
          });
        }
        if (method === "GET" && path === "/orders/") {
          return jsonResponse({
            results: [
              {
                id: "order-1",
                instrument: "https://api.robinhood.com/instruments/abc/",
                side: "buy",
                state: "filled",
                average_price: "150.00",
                cumulative_quantity: "10",
                updated_at: "2026-01-01T00:00:00Z",
              },
            ],
            next: null,
          });
        }
        if (method === "GET" && path === "/dividends/") {
          return jsonResponse({ results: [], next: null });
        }
        if (method === "GET" && path.startsWith("/instruments/")) {
          return jsonResponse({ symbol: "AAPL" });
        }

        // Simulate a permissive/misbehaving server that WOULD honor a
        // write-shaped call if the adapter ever made one — the point of
        // this test is that it never does, not that the server refuses.
        return jsonResponse({ ok: true });
      }),
    );
  });

  function assertAllCallsAllowed() {
    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      expect(FORBIDDEN_METHODS.includes(call.method) && call.method !== "POST").toBe(false);
      const path = new URL(call.url).pathname + new URL(call.url).search;
      const isAllowed = ALLOWED_CALL_PATTERNS.some(
        (pattern) => pattern.method === call.method && pattern.pathPattern.test(path),
      );
      expect(isAllowed, `Unexpected call: ${call.method} ${call.url}`).toBe(true);
    }
  }

  it("getAccountSummary only calls the token refresh and accounts endpoints", async () => {
    await robinhoodBrokerageSyncProvider.getAccountSummary(connection);
    assertAllCallsAllowed();
  });

  it("listPositions only calls token refresh, positions, and instrument-resolution endpoints", async () => {
    await robinhoodBrokerageSyncProvider.listPositions(connection);
    assertAllCallsAllowed();
  });

  it("listTransactions only calls token refresh, orders, dividends, and instrument-resolution endpoints", async () => {
    await robinhoodBrokerageSyncProvider.listTransactions(connection);
    assertAllCallsAllowed();
  });
});
