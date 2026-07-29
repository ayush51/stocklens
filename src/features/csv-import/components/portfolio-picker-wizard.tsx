"use client";

import { useState } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CsvImportWizard } from "@/features/csv-import/components/csv-import-wizard";

export function PortfolioPickerWizard({ portfolios }: { portfolios: { id: string; name: string }[] }) {
  const [portfolioId, setPortfolioId] = useState(portfolios[0]?.id ?? "");

  return (
    <div className="space-y-4">
      {portfolios.length > 1 ? (
        <div className="max-w-xs space-y-2">
          <Label htmlFor="import-portfolio">Import into</Label>
          <Select value={portfolioId} onValueChange={(value) => value && setPortfolioId(value)}>
            <SelectTrigger id="import-portfolio" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {portfolios.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      <CsvImportWizard key={portfolioId} portfolioId={portfolioId} />
    </div>
  );
}
