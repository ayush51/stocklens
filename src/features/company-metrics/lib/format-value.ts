export function formatMetricValue(value: string, unit: string): string {
  if (unit === "USD") {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
  }
  if (unit === "PERCENT") return `${value}%`;
  return value;
}
