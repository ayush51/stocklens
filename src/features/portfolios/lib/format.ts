/** Client-safe formatting helpers — no server-only imports, so components can use them directly. */

export function formatMoney(value: string | null): string {
  if (value === null) return "—";
  const num = Number(value);
  const sign = num < 0 ? "-" : "";
  return `${sign}$${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** For gain/loss figures — sign-prefixed (e.g. "+12.34%"). */
export function formatPercent(value: string | null): string {
  if (value === null) return "—";
  const num = Number(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num.toFixed(2)}%`;
}

/** For non-directional figures like allocation share — no sign prefix. */
export function formatPlainPercent(value: string | null): string {
  if (value === null) return "—";
  return `${Number(value).toFixed(2)}%`;
}

export function gainLossClassName(value: string | null): string {
  if (value === null) return "text-muted-foreground";
  const num = Number(value);
  if (num > 0) return "text-emerald-600 dark:text-emerald-400";
  if (num < 0) return "text-destructive";
  return "text-muted-foreground";
}

/** Direction glyph so gain/loss isn't conveyed by color alone — "" when flat or unknown. */
export function gainLossArrow(value: string | null): string {
  if (value === null) return "";
  const num = Number(value);
  if (num > 0) return "▲ ";
  if (num < 0) return "▼ ";
  return "";
}
