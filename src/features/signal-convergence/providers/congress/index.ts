import type {
  CongressionalTransactionRecord,
  CongressionalTransactionsProvider,
} from "@/shared/contracts/congressional-transactions-provider";

/**
 * Wraps a fixed, already-imported set of records — used both for a real
 * manual CSV import (see manual-import.ts + the importCongressionalCsv
 * server action) and for sampleCongressProvider below. isLiveOfficialSource
 * is always false here: this provider never talks to House/Senate systems.
 */
export function createManualCongressProvider(
  records: CongressionalTransactionRecord[],
  sourceName = "manual_import",
): CongressionalTransactionsProvider {
  return {
    sourceName,
    isLiveOfficialSource: false,
    async listRecentTransactions(opts) {
      let filtered = records;
      if (opts?.since) {
        const sinceStr = opts.since.toISOString().slice(0, 10);
        filtered = filtered.filter((r) => r.filingDate >= sinceStr);
      }
      const sorted = [...filtered].sort((a, b) => b.filingDate.localeCompare(a.filingDate));
      return opts?.limit ? sorted.slice(0, opts.limit) : sorted;
    },
  };
}
