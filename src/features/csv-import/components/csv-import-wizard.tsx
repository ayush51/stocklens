"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseCsvWithHeaders } from "@/features/csv-import/lib/parse-csv";
import { computeFileChecksum } from "@/features/csv-import/lib/checksum";
import {
  mapAndValidateRows,
  type ColumnMapping,
  type MapRowsResult,
} from "@/features/csv-import/lib/row-mapper";
import type { TransactionTypeValue } from "@/features/csv-import/lib/transaction-types";
import { confirmCsvImport, type ImportSummary } from "@/features/csv-import/server/actions";
import { UploadStep } from "@/features/csv-import/components/steps/upload-step";
import { ColumnMappingStep } from "@/features/csv-import/components/steps/column-mapping-step";
import { TypeMappingStep } from "@/features/csv-import/components/steps/type-mapping-step";
import { PreviewStep } from "@/features/csv-import/components/steps/preview-step";
import { ImportSummaryView } from "@/features/csv-import/components/steps/import-summary-view";

type Step = "upload" | "columns" | "types" | "preview" | "done";

export interface ParsedFile {
  filename: string;
  checksum: string;
  headers: string[];
  rows: string[][];
}

export function CsvImportWizard({ portfolioId }: { portfolioId: string }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(null);
  const [preview, setPreview] = useState<MapRowsResult | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleFile(file: File) {
    try {
      const [text, checksum] = await Promise.all([file.text(), computeFileChecksum(file)]);
      const { headers, rows } = parseCsvWithHeaders(text);
      if (headers.length === 0 || rows.length === 0) {
        toast.error("This file has no rows to import.");
        return;
      }
      setParsedFile({ filename: file.name, checksum, headers, rows });
      setStep("columns");
    } catch {
      toast.error("Could not read this file.");
    }
  }

  function handleColumnMappingConfirmed(mapping: ColumnMapping) {
    setColumnMapping(mapping);
    setStep("types");
  }

  function handleTypeMappingConfirmed(mapping: Record<string, TransactionTypeValue | "SKIP">) {
    if (!parsedFile || !columnMapping) return;
    const result = mapAndValidateRows(parsedFile.rows, columnMapping, mapping);
    setPreview(result);
    setStep("preview");
  }

  async function handleConfirmImport() {
    if (!parsedFile || !columnMapping || !preview) return;
    setSubmitting(true);
    try {
      const result = await confirmCsvImport({
        portfolioId,
        filename: parsedFile.filename,
        checksum: parsedFile.checksum,
        columnMapping,
        rows: preview.valid,
      });
      setSummary(result);
      setStep("done");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("upload");
    setParsedFile(null);
    setColumnMapping(null);
    setPreview(null);
    setSummary(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import transactions from CSV</CardTitle>
      </CardHeader>
      <CardContent>
        {step === "upload" ? <UploadStep onFileSelected={handleFile} /> : null}

        {step === "columns" && parsedFile ? (
          <ColumnMappingStep
            headers={parsedFile.headers}
            sampleRow={parsedFile.rows[0] ?? []}
            onConfirm={handleColumnMappingConfirmed}
          />
        ) : null}

        {step === "types" && parsedFile && columnMapping ? (
          <TypeMappingStep
            rows={parsedFile.rows}
            typeColumnIndex={columnMapping.type}
            onConfirm={handleTypeMappingConfirmed}
            onBack={() => setStep("columns")}
          />
        ) : null}

        {step === "preview" && preview ? (
          <PreviewStep
            result={preview}
            onBack={() => setStep("types")}
            onConfirm={handleConfirmImport}
            submitting={submitting}
          />
        ) : null}

        {step === "done" && summary ? (
          <>
            <ImportSummaryView summary={summary} />
            <Button className="mt-4" variant="outline" onClick={reset}>
              Import another file
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
