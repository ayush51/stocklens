import type { BrokerageConnector, BrokerageProvider } from "@/shared/contracts/brokerage-connector";

/**
 * Placeholder for providers whose real implementation doesn't exist yet
 * (SnapTrade, Plaid Investments). Exists so the provider registry has a
 * complete, type-checked entry for every BrokerageProvider today, without
 * pretending any of these methods work. Every method throws — there is no
 * silent no-op path that could look like a successful sync of nothing.
 *
 * Gate access to these behind a disabled feature flag once feature flags
 * exist (see task: feature flags) — until then, nothing in the app
 * references this connector, which is itself the gate.
 */
export function createUnimplementedConnector(provider: BrokerageProvider): BrokerageConnector {
  function notImplemented(): never {
    throw new Error(`${provider} connector is not implemented yet`);
  }

  return {
    provider,
    capabilities: {
      accounts: false,
      balances: false,
      positions: false,
      transactions: false,
      taxLots: false,
      watchlists: false,
      trading: false,
    },
    connect: async () => notImplemented(),
    disconnect: async () => notImplemented(),
    syncAccounts: async () => notImplemented(),
    syncBalances: async () => notImplemented(),
    syncPositions: async () => notImplemented(),
    syncTransactions: async () => notImplemented(),
    syncTaxLots: async () => notImplemented(),
    healthCheck: async () => notImplemented(),
  };
}
