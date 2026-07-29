"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MapRowsResult } from "@/features/csv-import/lib/row-mapper";

const PREVIEW_ROW_LIMIT = 50;

export function PreviewStep({
  result,
  onBack,
  onConfirm,
  submitting,
}: {
  result: MapRowsResult;
  onBack: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{result.valid.length} ready to import</Badge>
        {result.skipped > 0 ? (
          <Badge variant="outline">{result.skipped} skipped (excluded types)</Badge>
        ) : null}
        {result.errors.length > 0 ? (
          <Badge variant="destructive">{result.errors.length} rows with errors</Badge>
        ) : null}
      </div>

      {result.errors.length > 0 ? (
        <div className="border-destructive/30 rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Error report</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {result.errors.map((error) => (
              <li key={error.rowNumber} className="text-muted-foreground">
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.valid.length > 0 ? (
        <div className="max-h-96 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ticker</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.valid.slice(0, PREVIEW_ROW_LIMIT).map((row) => (
                <TableRow key={row.rowNumber}>
                  <TableCell>{row.occurredAt}</TableCell>
                  <TableCell>{row.type.replaceAll("_", " ")}</TableCell>
                  <TableCell>{row.ticker ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.quantity ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.price ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.amount ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {result.valid.length > PREVIEW_ROW_LIMIT ? (
            <p className="text-muted-foreground mt-2 text-xs">
              Showing the first {PREVIEW_ROW_LIMIT} of {result.valid.length} rows.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          Back
        </Button>
        <Button onClick={onConfirm} disabled={result.valid.length === 0 || submitting}>
          {submitting ? "Importing…" : `Import ${result.valid.length} transactions`}
        </Button>
      </div>
    </div>
  );
}
