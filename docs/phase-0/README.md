# ThesisTrack — Phase 0

Phase 0 is design-only: no application code, no `package.json`, no `prisma/schema.prisma` committed to the project yet. Everything below is a decision record. Once this is reviewed and approved, Phase 1 (project scaffolding) begins per [11-implementation-plan.md](./11-implementation-plan.md).

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

- **Company-agnostic**: no ticker, sector, or data provider is hardcoded into the domain model. Every entity keys off a canonical `Company` resolved by ticker/CIK.
- **SaaS-ready from day one**: a lightweight `Workspace` tenancy boundary exists in the schema even though v1 ships single-user-per-workspace, so multi-seat teams don't require a data migration later.
- **Read-only brokerage access**: the Robinhood integration inherits the standing rule from `ROBINHOOD_MCP_SECURITY_PLAN.md` — no order placement, no account mutation, ever. This is enforced at the code layer, not just by convention. See [09-security-model.md](./09-security-model.md#robinhood-integration-boundary).
- **Provider-swappable integrations**: SEC EDGAR, financial-metrics, and AI-summary providers sit behind interfaces (dependency inversion) so a vendor can be swapped without touching feature code.
