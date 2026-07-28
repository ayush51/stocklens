# StockLens — Phase 0

Phase 0 is the design record for the product. **Status: Phase 1 (foundation) and the first slice of Phase 2 (`companies` — ticker resolution) are built and deployed.** This package was revised to move read-only Robinhood sync and forward-looking company monitoring into the MVP (Phases 2-6), ahead of manual/CSV portfolio entry (Phase 7) — see [11-implementation-plan.md](./11-implementation-plan.md) for the current phase order and a requirement-by-requirement mapping from the original plan.

## Contents

1. [Product Requirements Document](./01-prd.md)
2. [System Architecture](./02-architecture.md)
3. [Folder Structure](./03-folder-structure.md)
4. [Database Design](./04-database-design.md)
5. [Prisma Entity Diagram](./05-prisma-schema.md)
6. [Route Structure](./06-routes.md)
7. [API Design](./07-api-design.md)
8. [Component Architecture](./08-component-architecture.md)
9. [Security Model](./09-security-model.md)
10. [Data Flow](./10-data-flow.md)
11. [Implementation Plan](./11-implementation-plan.md)

## Ground rules baked into every doc below

- **Company-agnostic**: no ticker, sector, or data provider is hardcoded into the domain model. Every entity keys off a canonical `Company` resolved by ticker/CIK. Company-specific KPI overrides are data rows (`CompanyMetricDefinition`), never a ticker conditional in code.
- **SaaS-ready from day one**: a lightweight `Workspace` tenancy boundary exists in the schema even though v1 ships single-user-per-workspace, so multi-seat teams (Phase 9) don't require a data migration later.
- **Read-only brokerage access, and it's MVP-critical**: the Robinhood integration inherits the standing rule from `ROBINHOOD_MCP_SECURITY_PLAN.md` — no order placement, no transfer, no account mutation of any kind, ever. This is enforced at the code layer (the interface has no such methods, verified by tests), not just by convention. See [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary).
- **Provider-swappable integrations**: `FilingProvider`, `FundamentalDataProvider`, `MarketDataProvider`, `AnalystEstimateProvider`, `CompanyKPIProvider`, `BrokerageSyncProvider`, and `AISummaryProvider` all sit behind interfaces (dependency inversion) so a vendor can be swapped without touching feature code. Two of these (`MarketDataProvider`, `AnalystEstimateProvider`) currently have no chosen vendor — see [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks) — this is a real open dependency, not a hypothetical one.
- **Provenance travels with every externally-sourced number.** Source, source URL/filing accession where applicable, reporting period, observed timestamp, currency, and (for derived fields) calculation method — never presented without knowing where it came from or how fresh it is.
