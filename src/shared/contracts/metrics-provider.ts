/**
 * Financial metrics/statements data boundary — implemented by
 * features/financial-metrics/providers/edgar-xbrl (MVP) and any future paid
 * vendor, kept swappable without touching feature code.
 * See docs/phase-0/02-architecture.md §3.
 */

export interface FinancialStatementSummary {
  fiscalYear: number;
  fiscalPeriod: "Q1" | "Q2" | "Q3" | "Q4" | "FY";
  revenue: string | null;
  netIncome: string | null;
  grossProfit: string | null;
  eps: string | null;
  totalAssets: string | null;
  totalLiabilities: string | null;
  /** Deliberately no "totalDebt": real XBRL debt tags vary too inconsistently across companies (verified live: NVDA reports LongTermDebtNoncurrent + DebtCurrent separately, ORCL reports one combined LongTermDebt) to combine reliably into one figure without real risk of double-counting or under-counting. */
  operatingIncome: string | null;
  /**
   * These five cash-flow-statement fields are, for Q2/Q3 periods, often
   * the year-to-date cumulative figure through that quarter rather than a
   * standalone quarter — verified live (2026-07-30) against real NVDA and
   * ORCL SEC filings: e.g. ORCL's Q2 FY2026 operatingCashFlow is the sum
   * of Q1+Q2, not Q2 alone (Q1 is unaffected — it's YTD-cumulative from
   * day one of the fiscal year, so it equals the standalone quarter; FY is
   * the full year either way). This is how SEC XBRL itself reports these
   * concepts for many filers, not an artifact of this extraction. Treat
   * quarter-over-quarter deltas on these fields with that in mind.
   */
  operatingCashFlow: string | null;
  capitalExpenditures: string | null;
  cashAndEquivalents: string | null;
  stockBasedCompensation: string | null;
  dividendsPaid: string | null;
  buybacks: string | null;
  dilutedSharesOutstanding: string | null;
  sourceUrl: string | null;
}

export interface MetricsProvider {
  getFinancialStatements(cik: string, opts?: { limit?: number }): Promise<FinancialStatementSummary[]>;
}
