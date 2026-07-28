# Implementation Plan

Phased, dependency-ordered. Each phase has a definition-of-done that must hold before the next phase starts — this is a sequencing document, not a sprint calendar with dates.

**Revision note**: this plan was restructured to put read-only Robinhood sync and forward-looking company monitoring into the MVP, ahead of manual/CSV portfolio entry and analytics/alerts. The original plan built those first because they were simpler to sequence; the actual product requirement is that a user's *real* portfolio and *real* forward-looking research are the golden path, not a fallback after manual data entry. See [01-prd.md §6](./01-prd.md#6-golden-path-v1) for the golden path this plan now serves.

## Phase 0 — Design (this package)

**Status: complete upon review/approval of this document set.**

Definition of done: PRD, architecture, folder structure, database design, Prisma ERD, routes, API design, component architecture, security model, and data flow are all written and internally consistent (cross-references resolve, no contradicting decisions across documents). No application code exists yet.

## Phase 1 — Foundation & scaffolding

**Status: done.**

Goal: an empty but correctly-wired app deployed to Vercel, with auth working and the schema migrated — nothing product-shaped yet.

1. Repo scaffolding: Next.js 15 (App Router, TS strict mode), Tailwind, shadcn/ui init, ESLint, folder structure from [03-folder-structure.md](./03-folder-structure.md).
2. Supabase project, Prisma connected, initial migration from [05-prisma-schema.md](./05-prisma-schema.md).
3. RLS policies + the three-role model (`postgres`/`app_user`/`service_role_app`) — see [09-security-model.md §2](./09-security-model.md#2-authorization).
4. Supabase Auth wired: sign-up/sign-in, `middleware.ts` session refresh, workspace-auto-creation on first login (`app_private.bootstrap_workspace()`).
5. `(app)` shell layout, empty `/dashboard`.
6. Vercel project connected, env vars set per environment.
7. Core lib: validated env, `AppError` hierarchy, logger.
8. `companies` feature (ticker resolution via SEC EDGAR) — technically Phase 2-shaped work, but shipped here since every later phase needs it and it has no dependencies of its own.

**Definition of done**: a user can sign up, land on an empty dashboard, RLS enforces workspace isolation, and any ticker resolves to a `Company` record. Verified.

## Phase 2 — Robinhood connect + read-only sync (MVP-critical)

Goal: the first three steps of the golden path — **sign in → connect Robinhood → run a read-only sync → see real accounts and positions.** This is the first phase that touches a real brokerage account, so its security requirements are the acceptance criteria, not a follow-up review.

1. **`BrokerageSyncProvider` Robinhood adapter** (`features/brokerage-sync/providers/robinhood/`): session-based read-only client implementing exactly `getAccountSummary` / `listPositions` / `listTransactions` — no other methods exist to implement, because the interface has none. See [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary) for the full safety requirement list; every item there is a gate on this phase, not optional hardening:
   - Read-only capability allowlist enforced at the type level (already true by interface design) **and** verified by a test that asserts the interface's method set, so a future edit that adds a write method fails CI, not code review alone.
   - No trading, transfer, or account-modification tools exist anywhere in the adapter or its dependencies — verified by the same test plus a dependency audit of whatever Robinhood client library the adapter wraps.
   - Source-ID deduplication: `Transaction.externalId` uniqueness (already in the schema).
   - Idempotent sync: re-running a sync for the same connection is always safe (upsert by `externalId`, never re-derives `Holding` from scratch in a way that could double-count).
   - Sync audit log: every sync run (start, row counts, success/failure) writes an `AuditLog` row, not just connect/disconnect events.
   - Encrypted connection data: `BrokerageConnection.credentialRef` into a secret store, exactly as already designed — this phase is where it actually gets built, not just specified.
   - Global kill switch: an env-var-gated check (`BROKERAGE_SYNC_ENABLED`) at the top of every sync entry point — flipping it off in Vercel stops all sync activity without a deploy or a DB migration.
   - Tests proving application code cannot invoke write-capable operations — see the terminology note below.
2. **Connection flow**: `/settings/integrations/robinhood` — connect (stores `credentialRef`, requested scopes, auto-creates a `Portfolio` with `source: ROBINHOOD_SYNC` so no manual portfolio is a prerequisite), disconnect (revokes credential, keeps historical data), status display.
3. **Sync job**: Inngest function, `listPositions` + `listTransactions` → upsert `Transaction` rows → recompute `Holding` aggregates. Manually triggerable from the UI for V1 (a "sync now" button); scheduled via Vercel Cron once the manual path is proven.
4. **Minimal portfolio view**: just enough UI to render synced accounts/positions — a holdings table, not the full manual-entry CRUD (that's Phase 7). This is the smallest slice of `portfolios` that makes Robinhood sync visible.

**Terminology note carried over from the phase-order discussion**: "tests proving application code cannot invoke write-capable MCP tools" is implemented as tests against *this application's* `BrokerageSyncProvider` interface and Robinhood adapter — the deployed app has no MCP connection at all (MCP is this chat's tool-calling protocol, not something a Next.js runtime uses). If a literal MCP-tool-invocation test was intended, that would be a different, out-of-scope surface — flag if so.

**Definition of done**: a user connects their real Robinhood account, triggers a sync, and sees real accounts/positions rendered from `Transaction`/`Holding` rows — the same tables manual entry and CSV import will later write to, no parallel data model. Security checklist above fully verified, not partially.

## Phase 3 — Reported fundamentals (expanded) + market data + valuation

Goal: the fourth golden-path step, first half — **open a holding → see financial trends and valuation.** Builds on the `financial-metrics`/`filings` work already shipped in Phase 1-era work (EDGAR XBRL only, ~6 fields) by expanding it to the full core-metrics list and adding a real current-price/valuation layer, which EDGAR cannot supply.

1. **Expand `FundamentalDataProvider`** (rename + broaden of the existing `MetricsProvider`/`metrics-provider.ts` — renamed when this phase's implementation starts, not before): add operating income/margin, operating cash flow, capex, free cash flow, cash, debt, net debt, stock-based compensation, diluted share count/dilution, dividends, buybacks, ROIC, ROE. Same EDGAR-XBRL-first approach as the existing implementation (tag-candidate fallback lists), same honesty about gaps (a concept EDGAR doesn't have stays `null`, never guessed).
2. **`MarketDataProvider`** (new): current price, shares outstanding, market cap — none of which SEC EDGAR supplies. **Requires a vendor decision before this can be built for real** (see [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks) — flagged, not resolved by this plan).
3. **Valuation**: market cap, enterprise value, P/S, EV/Revenue, EV/EBITDA, price-to-FCF, FCF yield, historical percentile, peer comparison — all computed at read time from `PriceSnapshot` × `FinancialStatement`, not persisted as their own rows (nothing to keep in sync, nothing to go stale independently). Trailing P/E lands here; forward P/E and PEG need Phase 4's consensus EPS and are deferred to that phase.
4. **Metric provenance**: every `FinancialStatement` row (existing and new fields) carries source, source URL/accession, reporting period, observed timestamp, currency, and — for derived fields like FCF/net debt — calculation method. Freshness is computed from `fetchedAt` at read time, not stored as a separate status column (a stored "fresh/stale" flag would itself go stale).
5. **Monitoring states, first half**: growth accelerating/stable/decelerating and margins improving/stable/declining, computed from the expanded historical series (a rolling comparison over the last N periods, not a stored classification — recomputed on read like the valuation ratios).

**Definition of done**: opening a real synced holding shows the full core-metrics list with real values (not just revenue/net income/EPS/assets/liabilities), current valuation ratios computed from real price data, and growth/margin trajectory states — all with visible provenance (where each number came from and how fresh it is).

## Phase 4 — Forward-looking data (external vendor dependency)

Goal: the fourth golden-path step, second half — **forward expectations.** This phase cannot start until a market-data/estimates vendor is chosen and contracted; SEC EDGAR has no consensus estimates, no guidance, no revision history. Flagged as a hard external dependency, not a risk to manage around.

1. **`AnalystEstimateProvider`** (new): quarterly/annual revenue and EPS consensus (mean/high/low/analyst count), captured as a time series (`asOfDate` per snapshot) so revisions are a diff between rows, not a separately-maintained table.
2. Revisions: 30/60/90-day comparison windows, upward/downward revision counts — computed from the `AnalystEstimate` time series at read time.
3. **Guidance**: company-issued guidance (low/high/midpoint), direction relative to the company's own prior guidance (raised/maintained/lowered), guidance midpoint vs. consensus.
4. Revenue and earnings surprise history: actual (from `FinancialStatement`, once a period closes) vs. the consensus estimate that existed just before the report — a join across `AnalystEstimate` and `FinancialStatement`, not new storage.
5. Forward P/E and PEG (now unblocked by consensus EPS from this phase).
6. Upcoming earnings surfaced as a catalyst input for Phase 6's monitoring rollup — `EarningsEvent` dates are cheap to get from EDGAR submissions/vendor calendars; this phase just makes them visible as "next catalyst," not the full `EarningsReview` notes feature (Phase 8).
7. **Monitoring states**: estimates revised up/flat/down, computed from the revision data above.

**Definition of done**: a real synced holding shows consensus estimates, revision trend, guidance vs. consensus, and surprise history, sourced from the chosen vendor — with the same provenance requirements as Phase 3 (source, timestamp, freshness).

## Phase 5 — Company-specific KPI framework

Goal: the fourth golden-path step, third part — **company-specific KPIs.** The hardest phase in this plan to fully automate: most KPIs (SaaS NRR, retail same-store sales, bank NIM) live in unstructured earnings-release prose, not standardized XBRL tags. Scoped to ship with manual and data-provider sources working end-to-end; filing-derived extraction is a stretch goal for this phase, not a launch requirement — treated as a future AI-extraction problem (Phase 9's `ai-summaries` infrastructure is the natural home for that, once it exists) rather than blocking this phase on solving it now.

1. **Schema**: `IndustryMetricTemplate` (industry → standard metric set), `CompanyMetricDefinition` (key, label, unit, aliases, `sourceType`: `FILING_DERIVED`/`DATA_PROVIDER`/`MANUAL`, optional `companyId` for an override), `CompanyKPIValue` (the observed values). Overrides are data rows keyed by a shared `key` string against a company-specific `CompanyMetricDefinition`, never a hardcoded ticker branch in code.
2. **`CompanyKPIProvider`** (new): a composite provider — tries data-provider sources first (if the chosen Phase 4 vendor also covers KPIs), falls back to manually-maintained values, exposes filing-derived as a pluggable source without requiring it to ship working on day one.
3. **Initial industry templates**: SaaS (ARR, NRR, CAC, magic number), banks (NIM, efficiency ratio, NPL ratio), retail (same-store sales, inventory turns), semiconductors (fab utilization, backlog), subscription businesses (churn, LTV/CAC), marketplaces (GMV, take rate). Six templates, not an exhaustive taxonomy — a template is data, so adding a seventh later is a seed script, not a migration.

**Definition of done**: a company matched to one of the six templates shows its industry-standard KPIs (from whichever source is available), and adding a new KPI or overriding one for a specific company requires no code change.

## Phase 6 — Thesis, catalysts, risks, monitoring rollup

Goal: the golden path's final step — **catalysts, risks, and thesis status.** Completes "open a holding → see everything relevant to whether I should still hold it."

1. **`thesis` feature**: create/edit thesis per company (optionally linked to a `Holding`), `ThesisRevision` history on every edit — as originally designed, just resequenced.
2. **`Thesis.status` remap**: `ACTIVE`/`NEEDS_REVIEW`/`CLOSED` → `ON_TRACK`/`WATCH`/`BROKEN`/`UNREVIEWED` (default `UNREVIEWED` — a new thesis hasn't been checked against anything yet, so it shouldn't default to a claim of health).
3. **`Catalyst`, `Risk` models** (new, tenant-owned): user-tracked catalysts (earnings dates surfaced from Phase 4, plus manually-added product-launch/regulatory/macro items) and risks (severity, status), each optionally linked to a `Thesis`.
4. **Monitoring rollup**: valuation-below/near/above-historical-range (from Phase 3's percentile calc), thesis on-track/watch/broken/unreviewed, upcoming catalysts, active risks, and stale-data warnings (surfaced per-metric from each provider's freshness, rolled up to a holding-level summary) — assembled into one "how's this holding doing" view per holding.

**Definition of done**: opening a holding shows a single monitoring summary combining Phase 3's trends, Phase 4's forward expectations, Phase 5's KPIs, and this phase's catalysts/risks/thesis status — the golden path is now complete end-to-end for a Robinhood-synced holding.

## Phase 7 — Alternative ingestion paths (manual + CSV)

Goal: manual and CSV portfolio entry, as ingestion paths alongside Robinhood — never a prerequisite for it, per the explicit requirement that reordered this plan.

1. **`portfolios` feature, full**: create/edit/delete portfolios, manual holding/transaction entry, full holdings table — the Phase 2 minimal view was read-only-from-sync; this adds real CRUD for manually-sourced positions.
2. **`csv-import` feature**: upload → column mapping → Inngest job → reconciliation into `Transaction`/`Holding`, exactly as originally designed.

**Definition of done**: a user can add a position manually or via CSV and it renders through the same holding-detail monitoring view Phase 2-6 built for Robinhood-synced positions — one code path for "how's this holding doing" regardless of how the position got into the system.

## Phase 8 — Analytics, earnings review, alerts

1. **`analytics` feature**: portfolio-level allocation, unrealized/realized gain-loss, performance chart.
2. **`earnings` feature, full**: `EarningsReview` notes form (distinct from Phase 4's estimate/date data), wired to optionally spawn a `ThesisRevision`.
3. **`alerts` feature**: `AlertRule` CRUD, evaluation job (price/filing/earnings/thesis-stale), email delivery.

**Definition of done**: portfolio-level rollups exist across all holdings regardless of source; a user can journal an earnings reaction and have it update their thesis; alerts fire and deliver.

## Phase 9 — AI + SaaS expansion

1. `ai-summaries` feature: filing/earnings summarization — and the natural home for Phase 5's filing-derived KPI extraction stretch goal, once this infrastructure exists.
2. Thesis-drift detection.
3. Multi-seat workspaces (`WorkspaceMember` `EDITOR`/`VIEWER` enforcement turned on).
4. Public/opt-in shareable thesis pages.
5. Billing (Stripe).

**Definition of done**: out of scope for detailed planning now — gets its own design pass once Phase 8 ships.

## Cross-phase, ongoing from Phase 1 onward

- **Testing**: unit tests for `server/service.ts` business logic land alongside the feature that introduces them. Integration tests against a real (test) Postgres for anything touching RLS. Phase 2 specifically requires tests proving no write-capable Robinhood operation is reachable from application code — not deferred, not optional.
- **Multi-ticker discipline**: every fixture, seed script, and test uses at least two unrelated tickers (see [01-prd.md §4](./01-prd.md#4-non-goals-explicit)).
- **Docs**: this `docs/phase-0/` package is a living reference — when an implementation decision meaningfully diverges from what's written here, the doc gets updated in the same PR.
- **Vendor dependencies are explicit blockers, not soft risks**: Phase 4 cannot start without an analyst-estimates vendor decision; Phase 3's `MarketDataProvider` needs a current-price vendor (may be the same vendor as Phase 4, may not). Neither is assumed resolved by this plan.
