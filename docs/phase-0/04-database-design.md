# Database Design

PostgreSQL via Supabase. This document is the entity-relationship rationale; the concrete schema is in [05-prisma-schema.md](./05-prisma-schema.md).

## 1. Design principles

- **Every tenant-owned table carries `workspaceId`.** No exceptions. This is what makes RLS and future multi-seat teams possible without a migration.
- **`Company` is the only anchor for anything ticker-related.** Holdings, filings, metrics, theses, earnings events all foreign-key to `Company`, never to a bare ticker string, so a ticker rename/delisting doesn't orphan data.
- **Source-of-truth vs. cache is explicit.** Tables like `PriceSnapshot`, `FinancialMetric`, and `SecFiling` are caches of external data, refreshed by background jobs — they are never written to from user-facing mutation paths.
- **Money uses `Decimal`, never `Float`.** Quantities and prices are `Decimal(20,6)` / `Decimal(20,4)` to avoid floating-point drift in P&L math.
- **Append-only history where the record has audit value.** `ThesisRevision`, `Transaction`, and `AuditLog` are never updated in place — they're inserted, and "current state" is derived (latest revision, or a materialized `currentX` field kept in sync by the write path).

## 2. Entity groups

### 2.1 Identity & tenancy

| Table | Purpose |
|---|---|
| `User` | Mirrors `auth.users` (Supabase). Row created via trigger/webhook on signup. Holds app-level profile fields only — never passwords (Supabase Auth owns those). |
| `Workspace` | Tenancy boundary. Created automatically (1 per user) on signup in V1; UI to create additional workspaces ships in Phase 3. |
| `WorkspaceMember` | Join table: `userId` × `workspaceId` × `role` (`OWNER`, `EDITOR`, `VIEWER`). V1 always has exactly one `OWNER` row per workspace; the table exists so Phase 3 doesn't need a migration. |

### 2.2 Portfolios & positions

| Table | Purpose |
|---|---|
| `Portfolio` | A named collection of holdings. `source`: `MANUAL`, `CSV_IMPORT`, `ROBINHOOD_SYNC`. |
| `Holding` | Current position in a `Company` within a `Portfolio`: quantity, average cost basis. Derived/recomputed from `Transaction` rows, not independently edited once transactions exist. |
| `Transaction` | Append-only ledger: `BUY`, `SELL`, `DIVIDEND`, `SPLIT`. Source of truth for `Holding` aggregates. Every CSV import and every Robinhood sync writes here, never directly to `Holding`. |
| `BrokerageConnection` | Metadata about a linked read-only brokerage session (Robinhood). Stores a reference to an encrypted credential, connection status, last-synced-at — **never** the credential itself in plaintext. See [09-security-model.md](./09-security-model.md). |
| `CsvImportJob` | Tracks an upload: status, column mapping used, row counts (success/error), error detail. |

### 2.3 Company & market data (shared across all tenants — not workspace-scoped)

| Table | Purpose |
|---|---|
| `Company` | Canonical company record: ticker, CIK (SEC identifier), name, exchange, sector, industry. Globally shared/deduplicated — looked up or created on first reference from any workspace. |
| `PriceSnapshot` | Cached daily (and optionally intraday) price point per `Company`. Populated by scheduled jobs, read by analytics/UI. |
| `FinancialStatement` | One reporting period (fiscal year or quarter) of structured financials for a `Company`: revenue, net income, EPS, etc., sourced from EDGAR XBRL company-facts. |
| `SecFiling` | Filing metadata (form type, filed date, accession number, URL) per `Company`, sourced from SEC EDGAR submissions API. |
| `EarningsEvent` | A scheduled/reported earnings date for a `Company`: date, EPS estimate vs. actual, revenue estimate vs. actual. |

These five tables are **global reference data**, not tenant data — they don't carry `workspaceId`. RLS on them is "readable by any authenticated user," writable only by the service role running background jobs.

### 2.4 Thesis & review (tenant-owned)

| Table | Purpose |
|---|---|
| `Thesis` | The current state of a user's investment thesis for a `Company` (optionally linked to a specific `Holding`): summary, conviction (`LOW`/`MEDIUM`/`HIGH`), target price, status (`ACTIVE`/`NEEDS_REVIEW`/`CLOSED`). |
| `ThesisRevision` | Append-only snapshot every time a `Thesis` is edited — full body + a reason/trigger (`MANUAL_EDIT`, `EARNINGS_REVIEW`, `FILING_REVIEW`). Powers "thesis history" UI and thesis-drift AI analysis. |
| `EarningsReview` | User's structured notes against a specific `EarningsEvent`: what changed, whether it affects the thesis, optional link creating a new `ThesisRevision`. |

### 2.5 Alerts & notifications (tenant-owned)

| Table | Purpose |
|---|---|
| `AlertRule` | A user-defined trigger: `type` (`PRICE_ABOVE`, `PRICE_BELOW`, `NEW_FILING`, `UPCOMING_EARNINGS`, `THESIS_STALE`), target `Company` or `Thesis`, threshold/config (JSON), active flag. |
| `AlertEvent` | A firing of an `AlertRule`: timestamp, payload snapshot, delivery status (`PENDING`, `SENT`, `FAILED`), channel (`EMAIL`, `IN_APP`). |

### 2.6 AI (tenant-owned, content-addressed)

| Table | Purpose |
|---|---|
| `AISummary` | Generated summary tied to a `SecFiling`, `EarningsEvent`, or `Thesis`. Keyed with a content hash of the input + prompt/model version so identical inputs don't regenerate (cost control), but a thesis edit or new filing invalidates the cache naturally (different hash). |

### 2.7 Cross-cutting

| Table | Purpose |
|---|---|
| `AuditLog` | Append-only record of security-sensitive actions: brokerage connect/disconnect, workspace membership changes, thesis deletion. Not a general activity feed — scoped to actions with security/compliance relevance. |

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

Workspace 1──* Thesis *──1 Company
Thesis 0..1──1 Holding
Thesis 1──* ThesisRevision
EarningsEvent 1──* EarningsReview *──1 Workspace
EarningsReview 0..1──1 ThesisRevision   (an earnings review can spawn a revision)

Workspace 1──* AlertRule 1──* AlertEvent

Workspace 1──* AISummary  (polymorphic subject: SecFiling | EarningsEvent | Thesis)

Workspace 1──* AuditLog *──1 User
```

## 4. Indexing strategy

- `Company.ticker` — unique index (case-insensitive/citext), the primary lookup path for the company research page.
- `Company.cik` — unique index, used by the filings/financials ingestion jobs.
- `(workspaceId)` — btree index on every tenant-owned table (backs RLS policy predicates and workspace-scoped list queries).
- `Transaction(portfolioId, occurredAt)` — composite, supports the ledger view and holding recomputation.
- `PriceSnapshot(companyId, asOfDate)` — composite unique, supports "price on date" and time-series chart queries.
- `SecFiling(companyId, filedAt)` — composite, supports "latest filings for company" queries.
- `AlertRule(active, type)` — partial index (`WHERE active = true`) to keep the scheduled evaluation sweep cheap.
- `AISummary(subjectType, subjectId, inputHash)` — unique composite, is the cache-hit lookup.

## 5. Row Level Security strategy

RLS is enabled on every tenant-owned table as defense-in-depth underneath application-layer authorization — implemented in the `rls_and_roles` (+ three follow-up) migrations, full mechanism documented in [09-security-model.md §2](./09-security-model.md#2-authorization). Shape:

- Tenant-owned tables: policy restricts rows to `workspaceId IN (SELECT app_private.current_user_workspace_ids())` — a `SECURITY DEFINER` helper rather than a raw self-referencing subquery on `WorkspaceMember`, to avoid the policy recursively re-applying itself to its own membership lookup. Tables one level removed from `workspaceId` (`Holding`, `Transaction`, `BrokerageConnection`, `CsvImportJob`, `ThesisRevision`, `AlertEvent`) scope via an `EXISTS` check against their parent's already-RLS-filtered row instead of repeating the membership lookup.
- Global reference tables (`Company`, `PriceSnapshot`, `FinancialStatement`, `SecFiling`, `EarningsEvent`): open `SELECT` policy (`USING (true)`); no `INSERT`/`UPDATE`/`DELETE` grant at all for the app-facing role — writes are `service_role_app`-only (background jobs).
- Application server code runs as `app_user` — `NOSUPERUSER`, `NOBYPASSRLS`, RLS genuinely applies to it, not just declared and bypassed by an owner-privileged connection. Background jobs that must write global reference data use `service_role_app` (`BYPASSRLS`) instead, a distinct, narrowly-scoped role — not the migration-owning `postgres` role, and not a blanket bypass available to request-serving code.

## 6. Retention & deletion

- Deleting a `Portfolio` cascades to its `Holding`/`Transaction` rows (tenant data, fully owned).
- Deleting a `Workspace` cascades to all tenant-owned tables scoped to it; global reference tables (`Company`, filings, prices) are untouched since they're shared.
- `ThesisRevision` and `AuditLog` are never deleted by user action (only by account-deletion/GDPR-style erasure flows, out of scope for Phase 0-1).
