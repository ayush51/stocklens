import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TermTooltip } from "@/features/glossary/components/term-tooltip";
import { computeDerivedMetrics } from "@/features/financial-metrics/lib/derived-metrics";

interface StatementRow {
  fiscalYear: number;
  fiscalPeriod: string;
  revenue: unknown;
  netIncome: unknown;
  grossProfit: unknown;
  eps: unknown;
  totalAssets: unknown;
  totalLiabilities: unknown;
  operatingIncome: unknown;
  operatingCashFlow: unknown;
  capitalExpenditures: unknown;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const epsFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function formatCurrency(value: unknown, formatter = currencyFormatter): string {
  if (value === null || value === undefined) return "—";
  const num = Number(value);
  return Number.isFinite(num) ? formatter.format(num) : "—";
}

export function MetricsTable({ statements }: { statements: StatementRow[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead>Revenue</TableHead>
            <TableHead>Net Income</TableHead>
            <TableHead>Gross Profit</TableHead>
            <TableHead>
              <TermTooltip termKey="operatingIncome">Operating Income</TermTooltip>
            </TableHead>
            <TableHead>
              <TermTooltip termKey="freeCashFlow">Free Cash Flow</TermTooltip>
            </TableHead>
            <TableHead>EPS (diluted)</TableHead>
            <TableHead>Total Assets</TableHead>
            <TableHead>Total Liabilities</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((statement) => {
            const derived = computeDerivedMetrics(statement);
            return (
              <TableRow key={`${statement.fiscalYear}-${statement.fiscalPeriod}`}>
                <TableCell className="font-medium">
                  {statement.fiscalPeriod === "FY"
                    ? `FY${statement.fiscalYear}`
                    : `${statement.fiscalPeriod} ${statement.fiscalYear}`}
                </TableCell>
                <TableCell>{formatCurrency(statement.revenue)}</TableCell>
                <TableCell>{formatCurrency(statement.netIncome)}</TableCell>
                <TableCell>{formatCurrency(statement.grossProfit)}</TableCell>
                <TableCell>{formatCurrency(statement.operatingIncome)}</TableCell>
                <TableCell>
                  {derived.freeCashFlow !== null ? currencyFormatter.format(derived.freeCashFlow) : "—"}
                </TableCell>
                <TableCell>{formatCurrency(statement.eps, epsFormatter)}</TableCell>
                <TableCell>{formatCurrency(statement.totalAssets)}</TableCell>
                <TableCell>{formatCurrency(statement.totalLiabilities)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-muted-foreground mt-2 text-xs">
        Free Cash Flow for Q2/Q3 periods is often the year-to-date cumulative figure through that quarter, not
        the standalone quarter — this is how SEC filings themselves report the underlying cash-flow figures
        for many companies.
      </p>
    </div>
  );
}
