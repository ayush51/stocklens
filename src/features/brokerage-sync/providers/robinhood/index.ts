import { readEncryptedSecret } from "@/lib/crypto/encrypted-secrets";
import type {
  AccountSummary,
  BrokerageConnectionRef,
  BrokerageSyncProvider,
  PositionSnapshot,
  TransactionRecord,
} from "@/shared/contracts/brokerage-sync-provider";

import { robinhoodRefreshToken } from "./auth";
import { getAccounts, getDividends, getFilledOrders, getNonzeroPositions, resolveInstrumentTicker } from "./client";

interface StoredRobinhoodCredential {
  refreshToken: string;
  deviceToken: string;
}

async function getAccessToken(credentialRef: string): Promise<string> {
  const raw = await readEncryptedSecret(credentialRef);
  const { refreshToken, deviceToken } = JSON.parse(raw) as StoredRobinhoodCredential;
  const tokens = await robinhoodRefreshToken(refreshToken, deviceToken);
  return tokens.accessToken;
}

/**
 * The only methods that exist to implement — getAccountSummary,
 * listPositions, listTransactions. No other method is reachable through
 * this object at all; there's nothing else on the interface to call, and
 * this class exposes nothing beyond it. See
 * docs/phase-0/09-security-model.md §3.1 and the safety tests in
 * brokerage-sync-provider.test.ts / robinhood-adapter.test.ts.
 */
export const robinhoodBrokerageSyncProvider: BrokerageSyncProvider = {
  async getAccountSummary(connection: BrokerageConnectionRef): Promise<AccountSummary> {
    const accessToken = await getAccessToken(connection.credentialRef);
    const accounts = await getAccounts(accessToken);
    const account = accounts[0];

    if (!account) {
      return { accountId: connection.connectionId, displayName: null, status: "ERROR" };
    }

    return { accountId: account.account_number, displayName: account.type, status: "CONNECTED" };
  },

  async listPositions(connection: BrokerageConnectionRef): Promise<PositionSnapshot[]> {
    const accessToken = await getAccessToken(connection.credentialRef);
    const positions = await getNonzeroPositions(accessToken);
    const tickerCache = new Map<string, string>();

    return Promise.all(
      positions.map(async (position) => ({
        externalId: position.instrumentUrl,
        ticker: await resolveInstrumentTicker(position.instrumentUrl, accessToken, tickerCache),
        quantity: position.quantity,
        averageCost: position.averageBuyPrice,
      })),
    );
  },

  async listTransactions(connection: BrokerageConnectionRef, since?: Date): Promise<TransactionRecord[]> {
    const accessToken = await getAccessToken(connection.credentialRef);
    const tickerCache = new Map<string, string>();

    const [orders, dividends] = await Promise.all([
      getFilledOrders(accessToken, since),
      getDividends(accessToken, since),
    ]);

    // SPLIT is intentionally never emitted here — no confidently-sourced
    // Robinhood endpoint for corporate-action history is implemented yet.
    // A holding's Transaction history through this adapter is BUY/SELL/
    // DIVIDEND only; splits would need to be reconciled manually until a
    // real endpoint is verified against a live account.
    const buysAndSells: TransactionRecord[] = await Promise.all(
      orders.map(async (order) => ({
        externalId: order.id,
        ticker: await resolveInstrumentTicker(order.instrumentUrl, accessToken, tickerCache),
        type: order.side === "buy" ? ("BUY" as const) : ("SELL" as const),
        quantity: order.quantity,
        price: order.price,
        occurredAt: order.occurredAt,
      })),
    );

    const dividendRecords: TransactionRecord[] = await Promise.all(
      dividends.map(async (dividend) => ({
        externalId: dividend.id,
        ticker: await resolveInstrumentTicker(dividend.instrumentUrl, accessToken, tickerCache),
        type: "DIVIDEND" as const,
        quantity: "0",
        price: dividend.amount,
        occurredAt: dividend.paidAt,
      })),
    );

    return [...buysAndSells, ...dividendRecords];
  },
};
