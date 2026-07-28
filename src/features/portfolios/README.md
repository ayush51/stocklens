# portfolios

Manual portfolio and holding management: create/list portfolios, holdings table, allocation view. `Holding` rows are derived from `Transaction` history, not independently edited — see `docs/phase-0/05-prisma-schema.md` §3.

Planned layout: `components/` (PortfolioCard, HoldingsTable, AllocationChart), `server/` (actions.ts, queries.ts, service.ts), `hooks/`, `types.ts`, `validation.ts`.
