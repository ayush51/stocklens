import { Badge } from "@/components/ui/badge";
import type { ImportSummary } from "@/features/csv-import/server/actions";

export function ImportSummaryView({ summary }: { summary: ImportSummary }) {
  return (
    <div className="space-y-3">
      <p className="font-medium">Import complete</p>
      <div className="flex flex-wrap gap-2">
        <Badge>{summary.imported} imported</Badge>
        {summary.duplicates > 0 ? (
          <Badge variant="outline">{summary.duplicates} already imported (skipped)</Badge>
        ) : null}
        {summary.failed > 0 ? <Badge variant="destructive">{summary.failed} failed</Badge> : null}
      </div>
      {summary.errors.length > 0 ? (
        <div className="border-destructive/30 rounded-md border p-3">
          <p className="mb-2 text-sm font-medium">Error report</p>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {summary.errors.map((error) => (
              <li key={error.rowNumber} className="text-muted-foreground">
                Row {error.rowNumber}: {error.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
