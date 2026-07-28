# Folder Structure

Feature-based architecture: `app/` is routing-only and stays thin; each feature owns its server logic, UI, and types under `src/features/*`. Cross-cutting infrastructure lives in `src/shared` and `src/lib`.

```
thesistrack/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts                      # multi-ticker synthetic seed data (never Oracle-only)
│
├── src/
│   ├── app/                         # Next.js App Router — routing + composition ONLY
│   │   ├── (marketing)/              # public pages, own layout
│   │   │   ├── page.tsx
│   │   │   └── pricing/page.tsx
│   │   ├── (auth)/                   # sign-in/sign-up, own layout, unauthenticated
│   │   │   ├── sign-in/page.tsx
│   │   │   └── sign-up/page.tsx
│   │   ├── (app)/                    # authenticated app shell
│   │   │   ├── layout.tsx            # sidebar/nav shell, session guard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── portfolios/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [portfolioId]/
│   │   │   │       ├── page.tsx
│   │   │   │       ├── import/page.tsx
│   │   │   │       └── holdings/[holdingId]/page.tsx
│   │   │   ├── companies/
│   │   │   │   └── [ticker]/
│   │   │   │       ├── page.tsx              # overview
│   │   │   │       ├── filings/page.tsx
│   │   │   │       ├── financials/page.tsx
│   │   │   │       ├── earnings/page.tsx
│   │   │   │       └── thesis/page.tsx
│   │   │   ├── theses/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [thesisId]/page.tsx
│   │   │   ├── alerts/page.tsx
│   │   │   └── settings/
│   │   │       ├── workspace/page.tsx
│   │   │       └── integrations/robinhood/page.tsx
│   │   ├── api/                      # Route Handlers — external-facing / webhook-style only
│   │   │   ├── webhooks/inngest/route.ts
│   │   │   ├── csv-import/[jobId]/route.ts
│   │   │   └── v1/…                  # see 07-api-design.md
│   │   ├── layout.tsx                 # root layout (theme, fonts, providers)
│   │   └── globals.css
│   │
│   ├── features/                     # one directory per domain capability
│   │   ├── portfolios/
│   │   │   ├── components/           # PortfolioCard, HoldingsTable, AllocationChart…
│   │   │   ├── server/                # actions.ts (Server Actions), queries.ts, service.ts
│   │   │   ├── hooks/
│   │   │   ├── types.ts
│   │   │   └── validation.ts          # zod schemas for this feature's inputs
│   │   ├── csv-import/
│   │   │   ├── components/            # UploadDropzone, ColumnMapper, ImportPreviewTable
│   │   │   ├── server/                 # parse.ts, reconcile.ts, job-handler.ts (Inngest fn)
│   │   │   └── types.ts
│   │   ├── brokerage-sync/
│   │   │   ├── providers/              # robinhood/ adapter implementing BrokerageSyncProvider
│   │   │   ├── server/
│   │   │   └── components/             # ConnectRobinhoodCard, SyncStatusBadge
│   │   ├── companies/
│   │   │   ├── components/             # CompanyHeader, MetricsGrid
│   │   │   ├── server/
│   │   │   └── types.ts
│   │   ├── filings/
│   │   │   ├── providers/              # sec-edgar/ adapter implementing FilingsProvider
│   │   │   ├── components/             # FilingsList, FilingViewer
│   │   │   └── server/
│   │   ├── financial-metrics/
│   │   │   ├── providers/              # edgar-xbrl/, (future) paid-vendor/
│   │   │   ├── components/             # MetricsTable, RatioTrendChart
│   │   │   └── server/
│   │   ├── thesis/
│   │   │   ├── components/             # ThesisEditor, ThesisRevisionHistory, ConvictionBadge
│   │   │   ├── server/
│   │   │   └── types.ts
│   │   ├── earnings/
│   │   │   ├── components/             # EarningsCalendar, EarningsReviewForm
│   │   │   └── server/
│   │   ├── alerts/
│   │   │   ├── components/             # AlertRuleForm, AlertList
│   │   │   └── server/                 # evaluators/ (one per AlertType)
│   │   ├── ai-summaries/
│   │   │   ├── providers/              # claude/ adapter implementing AISummaryProvider
│   │   │   ├── components/             # SummaryCard, RegenerateButton
│   │   │   └── server/
│   │   └── analytics/
│   │       ├── components/             # PerformanceChart, AllocationBreakdown
│   │       └── server/                  # calculators (pure functions, unit-testable)
│   │
│   ├── shared/
│   │   ├── contracts/                 # provider interfaces (dependency inversion boundary)
│   │   │   ├── filings-provider.ts
│   │   │   ├── metrics-provider.ts
│   │   │   ├── brokerage-sync-provider.ts
│   │   │   └── ai-summary-provider.ts
│   │   ├── components/                 # cross-feature composed components (not raw ui/)
│   │   │   ├── page-header.tsx
│   │   │   ├── empty-state.tsx
│   │   │   └── data-table/
│   │   └── hooks/                       # use-workspace.ts, use-debounced-value.ts…
│   │
│   ├── components/
│   │   └── ui/                          # shadcn/ui primitives (button, card, dialog…) — generated, rarely hand-edited
│   │
│   ├── lib/                             # cross-cutting infra, not domain logic
│   │   ├── db/prisma.ts                 # Prisma client singleton
│   │   ├── auth/session.ts              # server-side session helpers (wraps Supabase Auth)
│   │   ├── inngest/client.ts
│   │   ├── logger.ts
│   │   ├── env.ts                       # typed/validated env (zod)
│   │   └── errors.ts                    # AppError hierarchy, error-to-HTTP mapping
│   │
│   ├── jobs/                             # Inngest function registrations (imports feature job handlers)
│   │   └── index.ts
│   │
│   └── styles/
│       └── tailwind.config.ts
│
├── tests/
│   ├── unit/                             # mirrors src/features/*
│   ├── integration/                      # Prisma + test DB
│   └── e2e/                              # Playwright, multi-ticker fixtures
│
├── docs/
│   └── phase-0/                          # this design package
│
├── .env.example
├── middleware.ts                          # session refresh + route protection
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Rules this structure enforces

1. **`app/` never contains business logic.** Pages import a feature's `server/queries.ts` or call a Server Action from `server/actions.ts`. This keeps routing changes (renaming a URL segment) from ever touching domain logic.
2. **Features don't import each other's internals.** If `thesis` needs data from `companies`, it imports from `features/companies/server/queries.ts` (its public surface), never reaches into `features/companies/server/service.ts` internals. Cross-feature composition happens in `app/` or in `shared/`.
3. **All third-party integrations live under a feature's `providers/` folder and implement a `shared/contracts/*` interface.** Nothing outside that folder imports the vendor SDK directly (e.g., no file outside `features/filings/providers/sec-edgar` calls `fetch('https://data.sec.gov/...')`).
4. **`components/ui` is shadcn-generated and stays generic.** Anything with domain meaning (a `HoldingsTable`, not a `Table`) lives in the owning feature's `components/`.
