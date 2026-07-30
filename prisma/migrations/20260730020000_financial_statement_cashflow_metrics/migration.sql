-- Adds cash-flow-statement and balance-sheet metrics FinancialStatement
-- was missing entirely (instructions.md §7's core financial metrics list):
-- operating income, operating cash flow, capex, cash & equivalents,
-- stock-based compensation, dividends paid, buybacks, diluted share count.
-- All nullable additive columns on an existing table — no data migration,
-- no backfill required for existing rows.

ALTER TABLE "FinancialStatement"
  ADD COLUMN "operatingIncome" DECIMAL(24,2),
  ADD COLUMN "operatingCashFlow" DECIMAL(24,2),
  ADD COLUMN "capitalExpenditures" DECIMAL(24,2),
  ADD COLUMN "cashAndEquivalents" DECIMAL(24,2),
  ADD COLUMN "stockBasedCompensation" DECIMAL(24,2),
  ADD COLUMN "dividendsPaid" DECIMAL(24,2),
  ADD COLUMN "buybacks" DECIMAL(24,2),
  ADD COLUMN "dilutedSharesOutstanding" DECIMAL(20,0);
