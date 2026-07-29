"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ColumnMapping } from "@/features/csv-import/lib/row-mapper";

const DESTINATION_FIELDS: { key: keyof ColumnMapping; label: string; required: boolean }[] = [
  { key: "date", label: "Date", required: true },
  { key: "type", label: "Transaction type", required: true },
  { key: "ticker", label: "Ticker", required: false },
  { key: "quantity", label: "Quantity", required: false },
  { key: "price", label: "Price", required: false },
  { key: "amount", label: "Amount (cash value)", required: false },
  { key: "fees", label: "Fees", required: false },
];

const HEADER_GUESSES: Record<keyof ColumnMapping, string[]> = {
  date: ["date", "activity date", "trade date", "transaction date", "process date"],
  type: ["type", "trans code", "transaction type", "action", "description"],
  ticker: ["ticker", "symbol", "instrument"],
  quantity: ["quantity", "shares", "qty"],
  price: ["price", "share price", "unit price"],
  fees: ["fees", "fee", "commission"],
  amount: ["amount", "net amount", "total"],
};

function guessColumn(headers: string[], candidates: string[]): number | null {
  const normalized = headers.map((h) => h.toLowerCase().trim());
  for (const candidate of candidates) {
    const index = normalized.indexOf(candidate);
    if (index !== -1) return index;
  }
  return null;
}

function guessMapping(headers: string[]): ColumnMapping {
  return {
    date: guessColumn(headers, HEADER_GUESSES.date) ?? 0,
    type: guessColumn(headers, HEADER_GUESSES.type) ?? 0,
    ticker: guessColumn(headers, HEADER_GUESSES.ticker),
    quantity: guessColumn(headers, HEADER_GUESSES.quantity),
    price: guessColumn(headers, HEADER_GUESSES.price),
    fees: guessColumn(headers, HEADER_GUESSES.fees),
    amount: guessColumn(headers, HEADER_GUESSES.amount),
  };
}

export function ColumnMappingStep({
  headers,
  sampleRow,
  onConfirm,
}: {
  headers: string[];
  sampleRow: string[];
  onConfirm: (mapping: ColumnMapping) => void;
}) {
  const [mapping, setMapping] = useState<ColumnMapping>(() => guessMapping(headers));

  function setField(key: keyof ColumnMapping, value: string) {
    setMapping((prev) => ({ ...prev, [key]: value === "none" ? null : Number(value) }));
  }

  const canContinue = mapping.date !== null && mapping.type !== null;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Match each field to a column from your file. Best guesses are pre-filled — adjust anything that looks
        wrong.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {DESTINATION_FIELDS.map((field) => {
          const value = mapping[field.key];
          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={`map-${field.key}`}>
                {field.label} {field.required ? <span className="text-destructive">*</span> : null}
              </Label>
              <Select
                value={value === null ? "none" : String(value)}
                onValueChange={(v) => v && setField(field.key, v)}
              >
                <SelectTrigger id={`map-${field.key}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!field.required ? <SelectItem value="none">Not in this file</SelectItem> : null}
                  {headers.map((header, index) => (
                    <SelectItem key={header + index} value={String(index)}>
                      {header || `Column ${index + 1}`}
                      {sampleRow[index] ? ` — "${sampleRow[index]}"` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </div>
      <Button disabled={!canContinue} onClick={() => onConfirm(mapping)}>
        Continue
      </Button>
    </div>
  );
}
