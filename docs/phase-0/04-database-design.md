# Database Design

PostgreSQL via Supabase. This document is the entity-relationship rationale; the concrete schema is in [05-prisma-schema.md](./05-prisma-schema.md).

**Revision note**: expanded to support the Robinhood-first golden path — new global reference tables for market data, analyst estimates, guidance, and company-specific KPIs; new tenant-owned `Catalyst`/`Risk` tables; `FinancialStatement` broadened from a ~6-field MVP subset to the full core-metrics list; `Thesis.status` remapped to monitoring states. See [11-implementation-plan.md](./11-implementation-plan.md) for which phase each addition ships in.

## 1. Design principles

- **Every tenant-owned table carries `workspaceId`.** No exceptions. This is what makes RLS and future multi-seat teams possible without a migration.
- **`Company` is the only anchor for anything ticker-related.** Holdings, filings, metrics, estimates, KPIs, theses, catalysts, and risks all foreign-key to `Company`, never to a bare ticker string, so a ticker rename/delisting doesn't orphan data.
- **Source-of-truth vs. cache is explicit.** Tables like `PriceSnapshot`, `FinancialStatement`, `SecFiling`, `AnalystEstimate`, `Guidance`, and `CompanyKPIValue` are caches of external data, refreshed by background jobs — they are never written to from user-facing mutation paths.
- **Money uses `Decimal`, never `Float`.** Quantities and prices are `Decimal(20,6)` / `Decimal(20,4)` to avoid floating-point drift in P&L math.
- **Append-only history where the record has audit value.** `ThesisRevision`, `Transaction`, and `AuditLog` are never updated in place. `AnalystEstimate` is also append-only by design (one row per `asOfDate` snapshot) — revisions are computed by comparing rows, not by mutating one.
- **Provenance travels with every externally-sourced metric.** Every table populated by a provider (not user input) carries `source`, `sourceUrl`/`accessionNumber` where applicable, `currency`, and `fetchedAt`/`observedAt`. Freshness is *computed* from that timestamp at read time, never stored as its own "fresh/stale" column — a stored freshness flag would itself go stale.
- **Derived values are computed at read time, not persisted, unless recomputation is expensive.** Valuation ratios (P/E, EV/EBITDA, FCF yield, etc.) and monitoring-trajectory states (growth accelerating/decelerating, etc.) are calculated from `PriceSnapshot` × `FinancialStatement` × `AnalystEstimate` on read — there's no `ValuationSnapshot` table. The exception is genuinely derived-but-expensive-to-recompute fields like `FinancialStatement.freeCashFlow`, which are computed once at ingestion and stored, with `calculationMethod` documenting how.

## 2. Entity groups

### 2.1 Identity & tenancy

| Table | Purpose |
|---|---|
| `User` | Mirrors `auth.users` (Supabase). Row created via trigger/webhook on signup. Holds app-level profile fields only — never passwords (Supabase Auth owns those). |
| `Workspace` | Tenancy boundary. Created automatically (1 per user) on signup in V1; multi-seat UI ships in Phase 9. |
| `WorkspaceMember` | Join table: `userId` × `workspaceId` × `role` (`OWNER`, `EDITOR`, `VIEWER`). V1 always has exactly one `OWNER` row per workspace; the table exists so Phase 9 doesn't need a migration. |

### 2.2 Portfolios & positions

| Table | Purpose |
|---|---|
| `Portfolio` | A named collection of holdings. `source`: `MANUAL`, `CSV_IMPORT`, `ROBINHOOD_SYNC`. Connecting Robinhood auto-creates its own `Portfolio` row (`source: ROBINHOOD_SYNC`) — a manual portfolio is never a prerequisite (Phase 2 requirement). |
| `Holding` | Current position in a `Company` within a `Portfolio`: quantity, average cost basis. Derived/recomputed from `Transaction` rows, not independently edited once transactions exist. |
| `Transaction` | Append-only ledger: `BUY`, `SELL`, `DIVIDEND`, `SPLIT`. Source of truth for `Holding` aggregates. Robinhood sync, CSV import, and manual entry all write here, never directly to `Holding` — one data model regardless of how a position entered the system. |
| `BrokerageConnection` | Metadata about a linked read-only brokerage session (Robinhood). Stores a reference to an encrypted credential, connection status, last-synced-at — **never** the credential itself in plaintext. See [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary). |
| `CsvImportJob` | Tracks an upload: status, column mapping used, row counts (success/error), error detail. |

### 2.3 Company, market data & fundamentals (shared across all tenants — not workspace-scoped)

| Table | Purpose |
|---|---|
| `Company` | Canonical company record: ticker, CIK (SEC identifier), name, exchange, sector, industry. Globally shared/deduplicated — looked up or created on first reference from any workspace. `sector`/`industry` also drive `IndustryMetricTemplate` matching (see §2.6). |
| `PriceSnapshot` | Price point per `Company` per day, now also carrying `sharesOutstanding` and a computed `marketCap` — the input data valuation calculations read from. Populated by `MarketDataProvider` (Phase 3); a vendor decision blocks this table actually being current-data-fresh (see [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks)). |
| `FinancialStatement` | One reporting period of **reported historical** fundamentals for a `Company`. Expanded from the original 6-field MVP subset (revenue, net income, gross profit, EPS, assets, liabilities) to the full core-metrics list — see [05-prisma-schema.md](./05-prisma-schema.md) for the field list. Sourced from EDGAR XBRL company-facts; a concept EDGAR doesn't tag stays `null`, never guessed. |
| `SecFiling` | Filing metadata (form type, filed date, accession number, URL) per `Company`, sourced from SEC EDGAR submissions API. |
| `EarningsEvent` | A scheduled/reported earnings date for a `Company`: date, EPS estimate vs. actual, revenue estimate vs. actual. Surfaced as a catalyst input in Phase 4/6; the deeper `EarningsReview` notes feature is separate (§2.4, Phase 8). |
| `AnalystEstimate` *(new)* | Consensus revenue/EPS estimate for a `Company`'s fiscal period, captured as a time-series snapshot (`asOfDate`). Revisions (30/60/90-day windows, up/down counts) are computed by comparing consecutive rows for the same period — no separate revisions table. Requires an estimates vendor (Phase 4). |
| `Guidance` *(new)* | Company-issued guidance for a fiscal period: low/high/midpoint, `direction` (`RAISED`/`MAINTAINED`/`LOWERED`) relative to the company's own prior guidance for that period, source (filing MD&A, earnings call, press release). |

These seven tables are **global reference data**, not tenant data — they don't carry `workspaceId`. RLS on them is "readable by any authenticated user," writable only by the service role running background jobs.

### 2.4 Thesis & review (tenant-owned)

| Table | Purpose |
|---|---|
| `Thesis` | The current state of a user's investment thesis for a `Company` (optionally linked to a specific `Holding`): summary, conviction (`LOW`/`MEDIUM`/`HIGH`), target price, `status`. **Status values remapped** from `ACTIVE`/`NEEDS_REVIEW`/`CLOSED` to `ON_TRACK`/`WATCH`/`BROKEN`/`UNREVIEWED` (default `UNREVIEWED` — a new thesis hasn't been checked against anything yet). |
| `ThesisRevision` | Append-only snapshot every time a `Thesis` is edited — full body + a reason/trigger (`MANUAL_EDIT`, `EARNINGS_REVIEW`, `FILING_REVIEW`). |
| `EarningsReview` | User's structured notes against a specific `EarningsEvent`: what changed, whether it affects the thesis, optional link creating a new `ThesisRevision`. Phase 8, distinct from the Phase 4 estimate/date data on `EarningsEvent` itself. |
| `Catalyst` *(new, tenant-owned)* | A tracked upcoming event that could move a holding: `type` (`EARNINGS`/`PRODUCT_LAUNCH`/`REGULATORY`/`MACRO`/`OTHER`), description, expected date, optional link to a `Thesis`. Earnings-type catalysts are typically surfaced from the global `EarningsEvent` data; other types are user-added. |
| `Risk` *(new, tenant-owned)* | A tracked risk against a holding: description, `severity` (`LOW`/`MEDIUM`/`HIGH`), `status` (`ACTIVE`/`MONITORING`/`RESOLVED`), optional link to a `Thesis`. |

Both `Catalyst` and `Risk` are tenant-owned (not global) — even though an earnings date is an objective fact, *tracking* it as a catalyst for a specific holding is a per-workspace curation decision, consistent with how `AlertRule` and `Thesis` already work.

### 2.5 Company-specific KPI framework (shared reference definitions + tenant-agnostic values)

| Table | Purpose |
|---|---|
| `IndustryMetricTemplate` *(new)* | A named industry (`"SAAS"`, `"BANKS"`, `"RETAIL"`, `"SEMICONDUCTORS"`, `"SUBSCRIPTION"`, `"MARKETPLACES"` at launch — a plain string, not a hardcoded enum, so adding a seventh industry is a data insert, not a migration) and its standard `CompanyMetricDefinition` set. |
| `CompanyMetricDefinition` *(new)* | A KPI definition: `key` (stable machine name, e.g. `net_revenue_retention`), `label`, `unit`, `aliases` (alternate names this KPI is known by across filings/vendors), `sourceType` (`FILING_DERIVED`/`DATA_PROVIDER`/`MANUAL`). Either template-level (`templateId` set, `companyId` null) or a company-specific override (`companyId` set, matched to a template definition by sharing the same `key` — **never a hardcoded ticker conditional in code**, the override is a data row). |
| `CompanyKPIValue` *(new)* | An observed KPI value for a `Company` + `CompanyMetricDefinition` + fiscal period, with the same provenance fields (source, sourceUrl/accession, observedAt) as the other externally-sourced tables. |

These are global reference data like §2.3, except `CompanyMetricDefinition` rows can be company-specific overrides (still not tenant-owned — a KPI override belongs to the company, not to one workspace's view of it).

### 2.6 Alerts & notifications (tenant-owned)

| Table | Purpose |
|---|---|
| `AlertRule` | A user-defined trigger: `type` (`PRICE_ABOVE`, `PRICE_BELOW`, `NEW_FILING`, `UPCOMING_EARNINGS`, `THESIS_STALE`), target `Company` or `Thesis`, threshold/config (JSON), active flag. |
| `AlertEvent` | A firing of an `AlertRule`: timestamp, payload snapshot, delivery status (`PENDING`, `SENT`, `FAILED`), channel (`EMAIL`, `IN_APP`). |

### 2.7 AI (tenant-owned, content-addressed)

| Table | Purpose |
|---|---|
| `AISummary` | Generated summary tied to a `SecFiling`, `EarningsEvent`, or `Thesis`. Keyed with a content hash of the input + prompt/model version so identical inputs don't regenerate (cost control). Phase 9's eventual home for filing-derived KPI extraction, once that infrastructure exists. |

### 2.8 Cross-cutting

| Table | Purpose |
|---|---|
| `AuditLog` | Append-only record of security-sensitive actions: brokerage connect/disconnect, **every sync run** (start, row counts, success/failure — not just connect/disconnect), workspace membership changes, thesis deletion. Not a general activity feed — scoped to actions with security/compliance relevance. See [09-security-model.md §7](./09-security-model.md#7-audit-logging). |

## 3. Relationship summary

```
Workspace 1──* WorkspaceMember *──1 User
Workspace 1──* Portfolio 1──* Holding *──1 Company
Portfolio 1──* Transaction *──1 Company
Portfolio 1──0..1 BrokerageConnection
Portfolio 1──* CsvImportJob

Company 1──* PriceSnapshot
Company 1──* FinancialStatement
Company 1──* SecFiling
Company 1──* EarningsEvent
Company 1──* AnalystEstimate
Company 1──* Guidance
Company 1──* CompanyMetricDefinition (company-specific overrides)
Company 1──* CompanyKPIValue
IndustryMetricTemplate 1──* CompanyMetricDefinition (template-level)
CompanyMetricDefinition 1──* CompanyKPIValue

Workspace 1──* Thesis *──1 Company
Thesis 0..1──1 Holding
Thesis 1──* ThesisRevision
Workspace 1──* Catalyst *──1 Company
Catalyst *──0..1 Thesis
Workspace 1──* Risk *──1 Company
Risk *──0..1 Thesis
EarningsEvent 1──* EarningsReview *──1 Workspace
EarningsReview 0..1──1 ThesisRevision   (an earnings review can spawn a revision)

Workspace 1──* AlertRule 1──* AlertEvent

Workspace 1──* AISummary  (polymorphic subject: SecFiling | EarningsEvent | Thesis)

Workspace 1──* AuditLog *──1 User
```

## 4. Indexing strategy

- `Company.ticker` — unique index, the primary lookup path for the company research page.
- `Company.cik` — unique index, used by fundamentals/filings/estimates ingestion jobs.
- `(workspaceId)` — btree index on every tenant-owned table (backs RLS policy predicates and workspace-scoped list queries).
- `Transaction(portfolioId, occurredAt)` — composite, supports the ledger view and holding recomputation.
- `PriceSnapshot(companyId, asOfDate)` — composite unique, supports "price on date," time-series charts, and valuation calculations reading the latest row.
- `SecFiling(companyId, filedAt)` — composite, supports "latest filings for company" queries.
- `AnalystEstimate(companyId, fiscalYear, fiscalPeriod, metric, asOfDate)` — composite unique, is both the write-idempotency key and the query path for "consensus history for this period" (revisions = consecutive rows here).
- `Guidance(companyId, fiscalYear, fiscalPeriod)` — composite, supports "guidance history for this period."
- `CompanyKPIValue(companyId, fiscalYear, fiscalPeriod)` — composite, supports "all KPIs for this company/period" queries; `(definitionId, fiscalYear, fiscalPeriod)` unique, is the write-idempotency key.
- `CompanyMetricDefinition(companyId, key)` — unique, is the override-lookup path ("does this company override this template key").
- `AlertRule(active, type)` — partial index (`WHERE active = true`) to keep the scheduled evaluation sweep cheap.
- `AISummary(subjectType, subjectId, inputHash)` — unique composite, is the cache-hit lookup.

## 5. Row Level Security strategy

RLS is enabled on every tenant-owned table as defense-in-depth underneath application-layer authorization — implemented in the `rls_and_roles` (+ follow-up) migrations, full mechanism documented in [09-security-model.md §2](./09-security-model.md#2-authorization). Shape:

- Tenant-owned tables (including the new `Catalyst`/`Risk`): policy restricts rows to `workspaceId IN (SELECT app_private.current_user_workspace_ids())` — a `SECURITY DEFINER` helper rather than a raw self-referencing subquery on `WorkspaceMember`, to avoid the policy recursively re-applying itself to its own membership lookup. Tables one level removed from `workspaceId` (`Holding`, `Transaction`, `BrokerageConnection`, `CsvImportJob`, `ThesisRevision`, `AlertEvent`) scope via an `EXISTS` check against their parent's already-RLS-filtered row instead of repeating the membership lookup.
- Global reference tables (`Company`, `PriceSnapshot`, `FinancialStatement`, `SecFiling`, `EarningsEvent`, `AnalystEstimate`, `Guidance`, `IndustryMetricTemplate`, `CompanyMetricDefinition`, `CompanyKPIValue`): open `SELECT` policy (`USING (true)`); no `INSERT`/`UPDATE`/`DELETE` grant at all for the app-facing role — writes are `service_role_app`-only (background jobs). This list grew substantially in this revision but the pattern is identical to the original `Company`/`FinancialStatement`/`SecFiling` design — every new global table follows it without a new policy shape being invented.
- Application server code runs as `app_user` — `NOSUPERUSER`, `NOBYPASSRLS`, RLS genuinely applies to it, not just declared and bypassed by an owner-privileged connection. Background jobs (including all the new ingestion jobs: market data, estimates, KPIs) use `service_role_app` (`BYPASSRLS`) instead, a distinct, narrowly-scoped role — not the migration-owning `postgres` role, and not a blanket bypass available to request-serving code.

## 6. Retention & deletion

- Deleting a `Portfolio` cascades to its `Holding`/`Transaction` rows (tenant data, fully owned) — including Robinhood-sourced ones; disconnecting a `BrokerageConnection` does not delete this data (see [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary)).
- Deleting a `Workspace` cascades to all tenant-owned tables scoped to it, including `Catalyst`/`Risk`; global reference tables (`Company`, filings, prices, estimates, KPIs) are untouched since they're shared.
- `ThesisRevision` and `AuditLog` are never deleted by user action (only by account-deletion/GDPR-style erasure flows, out of scope for Phase 0-1).
