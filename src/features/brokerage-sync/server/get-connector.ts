import type { BrokerageConnector, BrokerageProvider } from "@/shared/contracts/brokerage-connector";
import { robinhoodMcpConnector } from "@/features/brokerage-sync/providers/robinhood-mcp";
import { manualConnector } from "@/features/brokerage-sync/providers/manual";
import { createUnimplementedConnector } from "@/features/brokerage-sync/providers/unimplemented";

/**
 * Single entry point feature code should use to reach a brokerage
 * connector — never import a concrete provider module directly. CSV_IMPORT
 * returns the unimplemented stub until task "CSV import" lands its real
 * parser; SNAPTRADE/PLAID are stubs indefinitely, per the Phase 2 spec
 * ("only the first three need to work in the initial release").
 */
export function getBrokerageConnector(provider: BrokerageProvider): BrokerageConnector {
  switch (provider) {
    case "ROBINHOOD_MCP":
      return robinhoodMcpConnector;
    case "MANUAL":
      return manualConnector;
    case "CSV_IMPORT":
    case "SNAPTRADE":
    case "PLAID":
      return createUnimplementedConnector(provider);
  }
}
