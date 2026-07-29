"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ALL_TRANSACTION_TYPES,
  type TransactionTypeValue,
} from "@/features/csv-import/lib/transaction-types";

const COMMON_LABEL_GUESSES: Record<string, TransactionTypeValue> = {
  buy: "BUY",
  sell: "SELL",
  dividend: "DIVIDEND",
  div: "DIVIDEND",
  cdiv: "DIVIDEND",
  "dividend reinvestment": "DIVIDEND_REINVESTMENT",
  drip: "DIVIDEND_REINVESTMENT",
  deposit: "DEPOSIT",
  "ach deposit": "DEPOSIT",
  withdrawal: "WITHDRAWAL",
  "ach withdrawal": "WITHDRAWAL",
  fee: "FEE",
  "gold fee": "FEE",
  interest: "INTEREST",
  "cash interest": "INTEREST",
  split: "SPLIT",
  "stock split": "SPLIT",
  "transfer in": "TRANSFER_IN",
  "transfer out": "TRANSFER_OUT",
};

function guessType(raw: string): TransactionTypeValue | "SKIP" {
  return COMMON_LABEL_GUESSES[raw.toLowerCase().trim()] ?? "SKIP";
}

export function TypeMappingStep({
  rows,
  typeColumnIndex,
  onConfirm,
  onBack,
}: {
  rows: string[][];
  typeColumnIndex: number;
  onConfirm: (mapping: Record<string, TransactionTypeValue | "SKIP">) => void;
  onBack: () => void;
}) {
  const distinctValues = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const value = (row[typeColumnIndex] ?? "").trim();
      if (value) set.add(value);
    }
    return [...set].sort();
  }, [rows, typeColumnIndex]);

  const [mapping, setMapping] = useState<Record<string, TransactionTypeValue | "SKIP">>(() =>
    Object.fromEntries(distinctValues.map((v) => [v, guessType(v)])),
  );

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Your file has {distinctValues.length} distinct transaction-type value
        {distinctValues.length === 1 ? "" : "s"}. Map each one — choose &quot;Skip&quot; to exclude rows of
        that type from the import.
      </p>
      <div className="space-y-2">
        {distinctValues.map((value) => (
          <div key={value} className="flex items-center justify-between gap-4 border-b py-2">
            <span className="text-sm font-medium">{value}</span>
            <Select
              value={mapping[value]}
              onValueChange={(v) =>
                setMapping((prev) => ({ ...prev, [value]: v as TransactionTypeValue | "SKIP" }))
              }
            >
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SKIP">Skip these rows</SelectItem>
                {ALL_TRANSACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={() => onConfirm(mapping)}>Preview import</Button>
      </div>
    </div>
  );
}
