# Route Structure

Next.js 15 App Router. Three route groups separate layout/auth concerns without affecting URLs: `(marketing)`, `(auth)`, `(app)`.

## 1. Route tree

```
/                                    (marketing)  public
/pricing                             (marketing)  public

/sign-in                             (auth)       public, redirects to /dashboard if authenticated
/sign-up                             (auth)       public, redirects to /dashboard if authenticated
/auth/callback                       (auth)       OAuth/email-link callback, no UI

/dashboard                           (app)        authenticated — cross-portfolio summary

/portfolios                          (app)        authenticated — list
/portfolios/new                      (app)        authenticated — create (manual or CSV entry point)
/portfolios/[portfolioId]            (app)        authenticated — holdings table, allocation, performance
/portfolios/[portfolioId]/import     (app)        authenticated — CSV upload + column mapping + preview
/portfolios/[portfolioId]/holdings/[holdingId]   (app) authenticated — single holding detail + linked thesis

/companies/[ticker]                  (app)        authenticated — overview (any valid ticker, not just held ones)
/companies/[ticker]/financials       (app)        authenticated — FinancialStatement history + ratios
/companies/[ticker]/filings          (app)        authenticated — SecFiling list
/companies/[ticker]/filings/[filingId]           (app) authenticated — filing detail + AI summary
/companies/[ticker]/earnings         (app)        authenticated — EarningsEvent history + calendar
/companies/[ticker]/thesis           (app)        authenticated — thesis for this company (create if none)

/theses                              (app)        authenticated — cross-portfolio thesis list, filter by status
/theses/[thesisId]                   (app)        authenticated — thesis detail, revision history, earnings reviews

/alerts                              (app)        authenticated — alert rules list + create

/settings/workspace                  (app)        authenticated — workspace name, members (Phase 3)
/settings/integrations/robinhood     (app)        authenticated — connect/disconnect, sync status, scopes shown read-only

/api/webhooks/inngest                Route Handler — Inngest step execution endpoint
/api/csv-import/[jobId]              Route Handler — upload target for CSV file (multipart), enqueues job
/api/v1/*                            Route Handlers — see 07-api-design.md
```

## 2. Layout hierarchy

```
app/layout.tsx                         # root: fonts, theme provider, toaster
├── (marketing)/layout.tsx             # marketing nav/footer
├── (auth)/layout.tsx                  # centered card layout, no nav
└── (app)/layout.tsx                   # sidebar + topbar shell
    ├── requires authenticated session (redirect to /sign-in otherwise)
    ├── resolves active Workspace (single workspace in V1; workspace switcher UI stubbed for Phase 3)
    └── children render inside the shell's <main>
```

## 3. Route protection

Handled in `middleware.ts` plus a server-side guard in `(app)/layout.tsx`:

- `middleware.ts` refreshes the Supabase session cookie on every request (required for SSR auth) and redirects unauthenticated requests to `/sign-in` for any path under `(app)`.
- `(app)/layout.tsx` re-checks the session server-side (defense in depth — middleware alone is not treated as sufficient for an authenticated data page) and resolves `workspaceId`, passed down via a server-only context helper (not client-side global state).
- `/companies/[ticker]/*` is authenticated (not public) in V1 — company research is a logged-in feature, not a public marketing surface. (Public read-only thesis pages are an explicit Phase 3 item, on a separate `/@[handle]/thesis/[slug]`-style route, opt-in per thesis.)

## 4. Dynamic segment resolution

| Segment | Resolves via | 404 behavior |
|---|---|---|
| `[ticker]` | `features/companies/server/queries.ts#getOrResolveCompanyByTicker` — looks up `Company`, and if absent, resolves via SEC EDGAR ticker lookup and creates the `Company` row on first view | Invalid/unresolvable ticker renders a "not found" state, not a hard 404, since the input is user-typed |
| `[portfolioId]`, `[holdingId]`, `[thesisId]` | Direct Prisma lookup, always scoped by `workspaceId` from the session — a valid ID belonging to another workspace renders `notFound()` (not a 403), to avoid confirming record existence to unauthorized users | `notFound()` |
| `[filingId]` | Prisma lookup on `SecFiling`, scoped by the route's `[ticker]` → `companyId` | `notFound()` |

## 5. Loading/error conventions

Every route segment under `(app)` that fetches data ships a `loading.tsx` (skeleton matching the eventual layout) and an `error.tsx` (feature-appropriate recovery action, e.g. "Retry sync" on the Robinhood settings page). This is a checklist item in the Phase 1 definition-of-done, not optional polish.
