import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TermTooltip } from "@/features/glossary/components/term-tooltip";
import type { GlossaryTermKey } from "@/features/glossary/lib/glossary";
import type { FundamentalRatios } from "@/shared/contracts/market-data-provider";

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

const FIELDS: {
  key: keyof FundamentalRatios;
  label: string;
  termKey: GlossaryTermKey;
  format: (v: string) => string;
}[] = [
  {
    key: "peRatioTrailing",
    label: "P/E (trailing)",
    termKey: "peRatioTrailing",
    format: (v) => Number(v).toFixed(2),
  },
  {
    key: "peRatioForward",
    label: "P/E (forward)",
    termKey: "peRatioForward",
    format: (v) => Number(v).toFixed(2),
  },
  { key: "priceToBook", label: "Price/Book", termKey: "priceToBook", format: (v) => Number(v).toFixed(2) },
  {
    key: "pegRatioTtm",
    label: "PEG (trailing)",
    termKey: "pegRatioTtm",
    format: (v) => Number(v).toFixed(2),
  },
  { key: "beta", label: "Beta", termKey: "beta", format: (v) => Number(v).toFixed(2) },
  {
    key: "dividendYieldTtm",
    label: "Dividend yield",
    termKey: "dividendYieldTtm",
    format: (v) => `${Number(v).toFixed(2)}%`,
  },
  {
    key: "week52High",
    label: "52-week high",
    termKey: "week52High",
    format: (v) => `$${Number(v).toFixed(2)}`,
  },
  { key: "week52Low", label: "52-week low", termKey: "week52Low", format: (v) => `$${Number(v).toFixed(2)}` },
  {
    key: "marketCap",
    label: "Market cap",
    termKey: "marketCap",
    format: (v) => compactCurrencyFormatter.format(Number(v)),
  },
  {
    key: "enterpriseValue",
    label: "Enterprise value",
    termKey: "enterpriseValue",
    format: (v) => compactCurrencyFormatter.format(Number(v)),
  },
  {
    key: "evToEbitdaTtm",
    label: "EV/EBITDA (trailing)",
    termKey: "evToEbitdaTtm",
    format: (v) => Number(v).toFixed(2),
  },
  {
    key: "priceToFcfTtm",
    label: "Price/FCF (trailing)",
    termKey: "priceToFcfTtm",
    format: (v) => Number(v).toFixed(2),
  },
];

export function RatiosPanel({ ratios }: { ratios: FundamentalRatios }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ratios</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {FIELDS.map((field) => {
          const value = ratios[field.key];
          if (typeof value !== "string") return null;
          return (
            <div key={field.key}>
              <p className="text-muted-foreground text-xs">
                <TermTooltip termKey={field.termKey}>{field.label}</TermTooltip>
              </p>
              <p className="text-lg font-semibold tabular-nums">{field.format(value)}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
