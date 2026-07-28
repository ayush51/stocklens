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
  sourceUrl: string | null;
}

export interface MetricsProvider {
  getFinancialStatements(cik: string, opts?: { limit?: number }): Promise<FinancialStatementSummary[]>;
}
