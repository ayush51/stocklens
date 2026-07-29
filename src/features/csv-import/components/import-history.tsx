"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { rollbackCsvImport } from "@/features/csv-import/server/actions";
import type { Prisma } from "@/generated/prisma/client";

type ImportJob = Prisma.CsvImportJobGetPayload<{ include: { portfolio: true } }>;

export function ImportHistory({ jobs }: { jobs: ImportJob[] }) {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRollback(jobId: string) {
    setPendingId(jobId);
    startTransition(async () => {
      try {
        await rollbackCsvImport(jobId);
        toast.success("Import rolled back");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Could not roll back this import.");
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import history</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Portfolio</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Imported</TableHead>
              <TableHead className="text-right">Duplicates</TableHead>
              <TableHead className="text-right">Failed</TableHead>
              <TableHead>Date</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((job) => (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.filename}</TableCell>
                <TableCell>{job.portfolio.name}</TableCell>
                <TableCell>
                  {job.rolledBackAt ? (
                    <Badge variant="outline">Rolled back</Badge>
                  ) : (
                    <Badge variant={job.status === "COMPLETED" ? "default" : "secondary"}>{job.status}</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{job.rowsSucceeded ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{job.rowsDuplicate ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{job.rowsFailed ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                  {job.createdAt.toLocaleString()}
                </TableCell>
                <TableCell>
                  {!job.rolledBackAt && (job.rowsSucceeded ?? 0) > 0 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending && pendingId === job.id}
                      onClick={() => handleRollback(job.id)}
                    >
                      {isPending && pendingId === job.id ? "Rolling back…" : "Roll back"}
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
