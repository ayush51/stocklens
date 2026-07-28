# financial-metrics

Structured financial statements/ratios. Implements `shared/contracts/metrics-provider.ts` via `providers/edgar-xbrl/` (MVP source — free, no vendor lock-in). A paid provider can be added later behind the same interface without touching feature code.

Planned layout: `providers/edgar-xbrl/`, `components/` (MetricsTable, RatioTrendChart), `server/`.
