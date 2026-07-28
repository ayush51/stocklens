import Link from "next/link";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { HoldingRow } from "@/features/portfolios/server/queries";

export function HoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ticker</TableHead>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Quantity</TableHead>
          <TableHead className="text-right">Avg cost</TableHead>
          <TableHead className="text-right">Cost basis</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.companyId}>
            <TableCell className="font-medium">
              <Link href={`/companies/${row.ticker}`} className="hover:underline">
                {row.ticker}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-64 truncate">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">{row.quantity}</TableCell>
            <TableCell className="text-right tabular-nums">${row.averageCost}</TableCell>
            <TableCell className="text-right tabular-nums">${row.costBasis}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
