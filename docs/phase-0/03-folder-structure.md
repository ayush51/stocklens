# Folder Structure

Feature-based architecture: `app/` is routing-only and stays thin; each feature owns its server logic, UI, and types under `src/features/*`. Cross-cutting infrastructure lives in `src/shared` and `src/lib`.

**Revision note**: three new feature directories (`market-data`, `analyst-estimates`, `company-kpis`) and three new/renamed contracts, added to support the Robinhood-first golden path — see [11-implementation-plan.md](./11-implementation-plan.md) for phasing.

```
stocklens/
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
│   │   │   │       ├── financials/page.tsx   # expanded core-metrics + valuation (Phase 3)
│   │   │   │       ├── estimates/page.tsx    # forward-looking data (Phase 4)
│   │   │   │       ├── kpis/page.tsx         # company-specific KPIs (Phase 5)
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
│   │   │   ├── components/           # PortfolioCard, HoldingsTable, AllocationChart, HoldingMonitoringSummary…
│   │   │   ├── server/                # actions.ts (Server Actions), queries.ts, service.ts
│   │   │   ├── hooks/
│   │   │   ├── types.ts
│   │   │   └── validation.ts          # zod schemas for this feature's inputs
│   │   ├── csv-import/                 # Phase 7 — alternative ingestion, never a Robinhood prerequisite
│   │   │   ├── components/            # UploadDropzone, ColumnMapper, ImportPreviewTable
│   │   │   ├── server/                 # parse.ts, reconcile.ts, job-handler.ts (Inngest fn)
│   │   │   └── types.ts
│   │   ├── brokerage-sync/             # Phase 2, MVP-critical
│   │   │   ├── providers/              # robinhood/ adapter implementing BrokerageSyncProvider — read-only
│   │   │   │                          # methods only; see docs/phase-0/09-security-model.md §3
│   │   │   ├── server/                 # sync job, kill-switch check, audit logging
│   │   │   └── components/             # ConnectRobinhoodCard, SyncStatusBadge
│   │   ├── companies/
│   │   │   ├── components/             # CompanyHeader, MetricsGrid
│   │   │   ├── server/
│   │   │   └── types.ts
│   │   ├── filings/
│   │   │   ├── providers/              # sec-edgar/ adapter implementing FilingProvider (renamed from
│   │   │   │                          # FilingsProvider when Phase 3 implementation starts)
│   │   │   ├── components/             # FilingsList, FilingViewer
│   │   │   └── server/
│   │   ├── financial-metrics/          # Phase 3 — expanded core-metrics list + valuation
│   │   │   ├── providers/              # edgar-xbrl/ adapter implementing FundamentalDataProvider
│   │   │   │                          # (renamed from MetricsProvider when Phase 3 implementation starts)
│   │   │   ├── components/             # MetricsTable, RatioTrendChart, ValuationCard
│   │   │   └── server/                 # includes growth/margin trajectory + valuation calculators (pure fns)
│   │   ├── market-data/                # Phase 3, new — vendor TBD, see docs/phase-0/02-architecture.md §6
│   │   │   ├── providers/              # implements MarketDataProvider
│   │   │   ├── components/
│   │   │   └── server/
│   │   ├── analyst-estimates/          # Phase 4, new — vendor TBD
│   │   │   ├── providers/              # implements AnalystEstimateProvider
│   │   │   ├── components/             # EstimatesTrendChart, GuidanceCard
│   │   │   └── server/                 # includes revision-direction calculator (pure fn over AnalystEstimate rows)
│   │   ├── company-kpis/               # Phase 5, new
│   │   │   ├── providers/              # implements CompanyKPIProvider (composite: data-provider/manual first,
│   │   │   │                          # filing-derived as a stretch goal)
│   │   │   ├── components/             # KPIGrid
│   │   │   └── server/                 # industry-template matching, override resolution
│   │   ├── thesis/                     # Phase 6 — also owns Catalyst/Risk (tenant-owned, linked to Thesis)
│   │   │   ├── components/             # ThesisEditor, ThesisRevisionHistory, ConvictionBadge, CatalystList, RiskList
│   │   │   ├── server/
│   │   │   └── types.ts
│   │   ├── earnings/                   # Phase 8 — EarningsReview notes; EarningsEvent dates/estimates
│   │   │   │                          # themselves are read via analyst-estimates/financial-metrics (Phase 4)
│   │   │   ├── components/             # EarningsCalendar, EarningsReviewForm
│   │   │   └── server/
│   │   ├── alerts/                     # Phase 8
│   │   │   ├── components/             # AlertRuleForm, AlertList
│   │   │   └── server/                 # evaluators/ (one per AlertType)
│   │   ├── ai-summaries/               # Phase 9
│   │   │   ├── providers/              # claude/ adapter implementing AISummaryProvider
│   │   │   ├── components/             # SummaryCard, RegenerateButton
│   │   │   └── server/
│   │   └── analytics/                  # Phase 8
│   │       ├── components/             # PerformanceChart, AllocationBreakdown
│   │       └── server/                  # calculators (pure functions, unit-testable)
│   │
│   ├── shared/
│   │   ├── contracts/                 # provider interfaces (dependency inversion boundary)
│   │   │   ├── filing-provider.ts            # renamed from filings-provider.ts, Phase 3
│   │   │   ├── fundamental-data-provider.ts  # renamed from metrics-provider.ts, Phase 3 (broadened)
│   │   │   ├── market-data-provider.ts       # new, Phase 3
│   │   │   ├── analyst-estimate-provider.ts  # new, Phase 4
│   │   │   ├── company-kpi-provider.ts       # new, Phase 5
│   │   │   ├── brokerage-sync-provider.ts    # unchanged — no write methods, Phase 2
│   │   │   └── ai-summary-provider.ts        # Phase 9
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
