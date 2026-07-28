# API Design

## 1. Server Actions vs. Route Handlers — decision rule

| Use | When |
|---|---|
| **Server Action** (`features/*/server/actions.ts`) | Any mutation triggered from a form/UI interaction within the app itself: create portfolio, edit thesis, create alert rule, connect Robinhood (kicks off a flow). Colocated with the page, gets progressive enhancement and Next.js's built-in CSRF protection for free. |
| **Route Handler** (`app/api/**`) | Anything that must be reachable by something other than our own React tree: file upload (`multipart/form-data` for CSV), webhooks (Inngest step callbacks, future Stripe), and the versioned `/api/v1/*` surface reserved for a future public API / mobile client. |

Default is Server Actions. Route Handlers are the exception, used only where Server Actions structurally don't fit.

## 2. `/api/v1/*` — versioned surface

Not exposed to third parties in V1, but built as if it will be, since "scalable for SaaS later" implies an eventual public/partner API and mobile app. All internal data-fetching in Phase 1-2 goes through Server Components calling `features/*/server/queries.ts` directly (no reason to round-trip through HTTP internally) — `/api/v1` exists for external consumers only and is versioned from day one so `v2` can be introduced without breaking anyone.

```
GET    /api/v1/companies/:ticker
GET    /api/v1/companies/:ticker/financials       # expanded core-metrics list + valuation (Phase 3)
GET    /api/v1/companies/:ticker/estimates        # consensus, revisions, guidance (Phase 4)
GET    /api/v1/companies/:ticker/kpis             # company-specific KPIs (Phase 5)
GET    /api/v1/companies/:ticker/filings
GET    /api/v1/companies/:ticker/earnings

GET    /api/v1/portfolios
GET    /api/v1/portfolios/:id
GET    /api/v1/portfolios/:id/holdings
GET    /api/v1/portfolios/:id/holdings/:holdingId   # the monitoring rollup (Phase 6): trends, forward
                                                     # expectations, valuation, KPIs, catalysts, risks, thesis status
GET    /api/v1/portfolios/:id/transactions

POST   /api/v1/brokerage-connections               # connect (Phase 2) — request only; the read-only scope
                                                     # allow-list is enforced server-side, not client-configurable
DELETE /api/v1/brokerage-connections/:id            # disconnect — revokes credential, keeps synced history
POST   /api/v1/brokerage-connections/:id/sync       # trigger a sync run — a no-op (not an error) when the
                                                     # global kill switch is off, see 09-security-model.md §3

GET    /api/v1/theses
GET    /api/v1/theses/:id
POST   /api/v1/theses
PATCH  /api/v1/theses/:id

GET    /api/v1/theses/:id/catalysts
POST   /api/v1/theses/:id/catalysts
GET    /api/v1/theses/:id/risks
POST   /api/v1/theses/:id/risks

GET    /api/v1/alerts
POST   /api/v1/alerts
DELETE /api/v1/alerts/:id
```

No endpoint anywhere places a brokerage order, initiates a transfer, or modifies brokerage account settings — see §8.

Auth: Bearer token (Supabase JWT for first-party mobile client later; API keys scoped to a `Workspace` for any future partner access — API keys are explicitly out of scope until there's a real external consumer, but the route shape anticipates it).

## 3. Request/response conventions

**Success envelope:**
```json
{
  "data": { "...": "..." },
  "meta": { "requestId": "..." }
}
```

**Paginated list envelope:**
```json
{
  "data": [ { "...": "..." } ],
  "meta": { "requestId": "...", "nextCursor": "opaque-cursor-or-null" }
}
```
Cursor-based, not offset-based — holdings/transactions/filings lists grow unbounded per company over time, and offset pagination degrades under that.

**Error envelope** (also what Server Actions throw as, caught by a shared error boundary):
```json
{
  "error": {
    "code": "THESIS_NOT_FOUND",
    "message": "Human-readable, safe to show in UI",
    "requestId": "..."
  }
}
```

`code` is a stable machine-readable string from the `AppError` hierarchy in `src/lib/errors.ts` (e.g. `VALIDATION_ERROR`, `NOT_FOUND`, `FORBIDDEN`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `BROKERAGE_SYNC_READONLY_VIOLATION`). HTTP status is derived from `code` via one mapping table, so status codes can't drift from the error taxonomy.

## 4. Validation

Every Server Action and Route Handler input is parsed through a `zod` schema defined in the owning feature's `validation.ts` before touching Prisma. No `any`-typed request bodies. Validation failure always returns `VALIDATION_ERROR` with field-level detail, never a raw Prisma/Postgres error message (which could leak schema detail).

## 5. Rate limiting

Applied at the edge (Vercel middleware / Upstash Ratelimit) on:
- `/api/csv-import/*` — upload endpoint, per-workspace limit (abuse/cost control on the parsing job).
- `/api/v1/*` — per-API-key limit once external access exists.
- Company research pages that trigger on-demand `Company` creation from EDGAR — per-user limit, since an unresolved ticker lookup hits an external API on the request path.

Internal Server Actions used only from our own authenticated UI are not separately rate-limited beyond normal auth — abuse surface is materially lower.

## 6. Idempotency

- CSV import and Robinhood sync writes go through `Transaction.externalId` uniqueness (see [05-prisma-schema.md](./05-prisma-schema.md)) — safe to retry a job at the step level without double-booking transactions.
- `POST /api/v1/theses` and other external-facing mutations accept an optional `Idempotency-Key` header, stored and checked the same way Stripe-style APIs do, since this surface is meant for programmatic/partner use where retries are expected.

## 7. Webhooks

`POST /api/webhooks/inngest` — the only inbound webhook in V1, used by Inngest to execute job steps. Verified via Inngest's signing key. No other inbound webhooks exist yet (no payment provider in V1; Stripe webhooks are a Phase 9 addition documented when billing is designed, not speculatively built now).

## 8. What's explicitly NOT in the API surface

No endpoint anywhere accepts a request that results in a brokerage order, cancellation, exercise, transfer, or account-modification of any kind. `BrokerageSyncProvider` (see [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary)) exposes only `getAccountSummary`/`listPositions`/`listTransactions` at the TypeScript interface level — there is no method to call even if a route handler wanted to, by construction rather than by convention. `POST /api/v1/brokerage-connections/:id/sync` (§2) is the entire brokerage-facing write surface, and it only ever triggers a read-then-upsert sync job, gated by the global kill switch — it cannot be parameterized into doing anything else, because the job it enqueues has no other capability to invoke.
