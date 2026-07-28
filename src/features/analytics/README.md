# analytics

Portfolio-level analytics: allocation breakdown, unrealized/realized gain-loss, performance chart. Calculators are pure functions over `Holding`/`Transaction`/`PriceSnapshot` data, unit-testable without a database.

Planned layout: `components/` (PerformanceChart, AllocationBreakdown), `server/` (calculators).
