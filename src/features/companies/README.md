# companies

Canonical `Company` resolution (ticker → CIK → get-or-create) and the company research overview page. Every other feature that references a ticker depends on this feature's queries, never resolves a `Company` independently.

Planned layout: `components/` (CompanyHeader, MetricsGrid), `server/`, `types.ts`.
