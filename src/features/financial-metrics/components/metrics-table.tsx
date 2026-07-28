import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StatementRow {
  fiscalYear: number;
  fiscalPeriod: string;
  revenue: unknown;
  netIncome: unknown;
  grossProfit: unknown;
  eps: unknown;
  totalAssets: unknown;
  totalLiabilities: unknown;
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Revenue</TableHead>
          <TableHead>Net Income</TableHead>
          <TableHead>Gross Profit</TableHead>
          <TableHead>EPS (diluted)</TableHead>
          <TableHead>Total Assets</TableHead>
          <TableHead>Total Liabilities</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {statements.map((statement) => (
          <TableRow key={`${statement.fiscalYear}-${statement.fiscalPeriod}`}>
            <TableCell className="font-medium">
              {statement.fiscalPeriod === "FY" ? `FY${statement.fiscalYear}` : `${statement.fiscalPeriod} ${statement.fiscalYear}`}
            </TableCell>
            <TableCell>{formatCurrency(statement.revenue)}</TableCell>
            <TableCell>{formatCurrency(statement.netIncome)}</TableCell>
            <TableCell>{formatCurrency(statement.grossProfit)}</TableCell>
            <TableCell>{formatCurrency(statement.eps, epsFormatter)}</TableCell>
            <TableCell>{formatCurrency(statement.totalAssets)}</TableCell>
            <TableCell>{formatCurrency(statement.totalLiabilities)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
