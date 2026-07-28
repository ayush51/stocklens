# Implementation Plan

Phased, dependency-ordered. Each phase has a definition-of-done that must hold before the next phase starts — this is a sequencing document, not a sprint calendar with dates.

## Phase 0 — Design (this package)

**Status: complete upon review/approval of this document set.**

Definition of done: PRD, architecture, folder structure, database design, Prisma ERD, routes, API design, component architecture, security model, and data flow are all written and internally consistent (cross-references resolve, no contradicting decisions across documents). No application code exists yet.

## Phase 1 — Foundation & scaffolding

Goal: an empty but correctly-wired app deployed to Vercel, with auth working and the schema migrated — nothing product-shaped yet.

1. Repo scaffolding: Next.js 15 (App Router, TS strict mode), Tailwind, shadcn/ui init, ESLint/Prettier, folder structure from [03-folder-structure.md](./03-folder-structure.md) laid down as empty directories with placeholder `index`/README markers where useful.
2. Supabase project (dev + staging), Prisma connected (`DATABASE_URL` pooled + `DIRECT_URL` direct), initial migration from [05-prisma-schema.md](./05-prisma-schema.md).
3. RLS policies written and migrated alongside the schema (not bolted on later) — see [04-database-design.md §5](./04-database-design.md#5-row-level-security-strategy).
4. Supabase Auth wired: sign-up/sign-in pages, `middleware.ts` session refresh, `User`-row-on-signup trigger, workspace-auto-creation on first login.
5. `(app)` shell layout (sidebar/topbar), empty `/dashboard`.
6. Vercel project connected, preview deployments working, env vars set per environment.
7. `src/lib/env.ts` (validated env), `src/lib/errors.ts` (`AppError` hierarchy + HTTP mapping), `src/lib/logger.ts` in place before any feature code, since every feature depends on them.

**Definition of done**: a user can sign up, land on an empty dashboard inside their auto-created workspace, and the DB has RLS enforcing workspace isolation (verified with a test: user A cannot read user B's empty-but-existing workspace row).

## Phase 2 — MVP feature set (matches PRD Phase 1 scope)

Build order matters here — each step is a dependency for the next:

1. **`companies` feature**: ticker search/resolution, `Company` get-or-create against SEC EDGAR ticker lookup. Everything else depends on being able to resolve a company.
2. **`financial-metrics` + `filings` features**: EDGAR XBRL company-facts ingestion (scheduled job) and EDGAR submissions ingestion, company overview/financials/filings pages. Read-only, no tenant data yet — safe to build and demo independently.
3. **`portfolios` feature (manual)**: create portfolio, manually add holdings/transactions, holdings table, basic allocation view.
4. **`csv-import` feature**: upload → column mapping → Inngest processing job → reconciliation into `Transaction`/`Holding`. Depends on `portfolios` existing.
5. **`thesis` feature**: create/edit thesis per company (optionally linked to a holding), revision history on edit.
6. **`analytics` feature**: portfolio-level allocation, unrealized/realized gain-loss, basic performance chart — depends on `portfolios` + `financial-metrics` (pricing) both existing.

**Definition of done**: a user can sign up, create a portfolio manually or via CSV, view any company's profile/financials/filings, write a thesis, and see portfolio analytics. This is the shippable MVP described in the PRD.

## Phase 3 — Sync, earnings, alerts (matches PRD Phase 2 scope)

1. **`brokerage-sync` feature**: `BrokerageSyncProvider` interface + Robinhood adapter, connection flow, secret-store integration, scheduled sync job. Security review against [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary) is a hard gate before this ships, not a follow-up.
2. **`earnings` feature**: `EarningsEvent` ingestion job, earnings calendar UI, `EarningsReview` form wired to spawn `ThesisRevision`.
3. **`alerts` feature**: `AlertRule` CRUD, evaluation job (all `AlertType` evaluators), email delivery.

**Definition of done**: a connected Robinhood account's holdings/transactions flow into the same `Transaction`/`Holding` tables CSV import uses (no parallel data model); earnings reviews can update a thesis; alerts fire and deliver email.

## Phase 4 — AI + SaaS expansion (matches PRD Phase 3 scope)

1. **`ai-summaries` feature**: `AISummaryProvider` interface + Claude adapter, filing summary generation, earnings summary generation, content-hash caching.
2. Thesis-drift detection (AI-assisted, using `AISummary` + `ThesisRevision` history).
3. Multi-seat workspaces: `WorkspaceMember` role enforcement turned on in the UI (invite flow, `EDITOR`/`VIEWER` permission checks activated in `server/actions.ts` — the checks are designed in Phase 1, this is where they're exercised).
4. Public/opt-in shareable thesis pages.
5. Billing (Stripe) for SaaS tiers — designed and documented when this phase starts, not speculated on in Phase 0.

**Definition of done**: out of scope for detailed planning now — Phase 4 gets its own design pass (mini "Phase 0") once Phase 3 ships, since AI cost/latency characteristics and real usage patterns from Phases 1-3 should inform it rather than upfront guessing.

## Cross-phase, ongoing from Phase 1 onward

- **Testing**: unit tests for `server/service.ts` business logic (pure functions, mocked Prisma) land alongside the feature that introduces them, not retrofitted. Integration tests against a real (test) Postgres for anything touching RLS. E2E (Playwright) covers the golden path per phase before that phase is called done.
- **Multi-ticker discipline**: every fixture, seed script, and test uses at least two unrelated tickers (see [01-prd.md §4](./01-prd.md#4-non-goals-explicit)) — a PR that only ever demos against one company is treated as under-tested.
- **Docs**: this `docs/phase-0/` package is a living reference — when an implementation decision meaningfully diverges from what's written here, the doc gets updated in the same PR, not left to drift.
