# Component Architecture

## 1. Layering

```
components/ui/           shadcn primitives — Button, Card, Dialog, Input, Table…
      ↑ composed by
shared/components/        cross-feature, domain-agnostic — PageHeader, EmptyState, DataTable, Chart wrapper,
                          MonitoringStateBadge (growth/margin/estimate/valuation/thesis trajectory — one
                          component, driven by a status prop, not five near-duplicate badge components)
      ↑ composed by
features/*/components/    domain components — HoldingsTable, ThesisEditor, FilingsList, MetricsGrid,
                          ValuationCard, EstimatesTrendChart, KPIGrid, CatalystList, RiskList,
                          HoldingMonitoringSummary (the Phase 6 rollup — composes the above, doesn't
                          reimplement them)
      ↑ composed by
app/**/page.tsx            page-level composition only — imports feature components, no logic of its own
```

Rule: a component never imports "downward-and-sideways" — `features/thesis/components` can use `shared/components` and `components/ui`, but not reach into `features/portfolios/components`. If a page needs both, composition happens in `app/`.

## 2. Server vs. Client components

Default to **Server Components**. A component becomes a Client Component only when it needs one of: interactivity (`onClick`, form state), browser APIs, or a React hook that requires the client runtime (`useState`, animation libraries).

Practical pattern per feature:
- `components/*-view.tsx` (Server) — fetches via `server/queries.ts`, renders data, passes plain serializable props down.
- `components/*-form.tsx` / `*-editor.tsx` (Client, `"use client"`) — interactive leaf, calls a Server Action on submit.
- Server Components pass Server Actions down as props to Client Components rather than Client Components importing `"use server"` files directly when the action needs page-specific revalidation context.

This keeps data-fetching Server-only (no client-side waterfall, no exposed query logic in the bundle) while keeping interactive surfaces properly isolated and small — smaller Client Component boundaries mean less JS shipped.

## 3. Data fetching pattern

- **Reads**: Server Components call `features/*/server/queries.ts` functions directly (which call Prisma). No client-side data-fetching library (no React Query/SWR) for data that's available at render time — Next.js's own caching/revalidation (`revalidatePath`/`revalidateTag` after Server Actions) covers it.
- **Writes**: Server Actions in `features/*/server/actions.ts`. Pattern: validate (zod) → authorize (workspace membership check) → call `server/service.ts` (business logic, pure-ish, testable) → Prisma write → `revalidatePath`/`revalidateTag`.
- **Client-side interactivity that needs live data without a full page reload** (e.g., CSV import progress, sync status polling): a small, scoped `useSWR`/`useQuery`-style hook is acceptable **only** inside the specific feature that needs it (`csv-import`, `brokerage-sync`) — not a global data-fetching layer. This is the one deliberate exception to "no client data-fetching library," justified by genuinely async background-job status that a static server render can't reflect.
- **Monitoring-state and valuation calculations live in `server/`, never in a component.** Growth/margin trajectory, estimate-revision direction, valuation-vs-historical-range, and the holding-level monitoring rollup (see [04-database-design.md §1](./04-database-design.md#1-design-principles)) are pure functions over `FinancialStatement`/`PriceSnapshot`/`AnalystEstimate` rows, colocated with the feature's `queries.ts` (or a sibling `monitoring.ts`) so they're unit-testable without rendering anything. A component receives an already-computed status (`"accelerating"`, `"watch"`, …), never the raw rows plus a classification function.

## 4. State management

- **No global client state store** (no Redux/Zustand app-wide). Server state lives on the server; the URL (search params) is the state container for filters/sort/pagination on list pages (`?status=active&sort=updatedAt`), which also makes those views shareable/bookmarkable and keeps Server Components able to read the state directly from `searchParams`.
- **Local component state** (`useState`/`useReducer`) for pure UI concerns: dialog open/closed, form field values before submit, multi-step wizard position (CSV column mapping).
- **`shared/hooks/use-workspace.ts`** exposes the current workspace/user to Client Components via a small React Context populated once in `(app)/layout.tsx` — read-only, not a mutation channel.

## 5. SOLID applied at the component level

- **Single Responsibility**: a "view" component fetches/lays out, a "form" component handles one form's input+submit, a "chart" component only draws — a component that both fetches and manages complex interactive state is a signal to split it.
- **Open/Closed**: `shared/components/data-table` accepts column definitions and render props rather than being forked per feature; new tables (holdings, transactions, filings, alerts) configure it instead of copy-pasting a table component.
- **Liskov substitution**: every `*Provider` adapter's UI-facing summary shape (e.g., a normalized `FilingSummary` from `FilingProvider`, or a normalized estimate shape from `AnalystEstimateProvider`) is what components render against — a component never special-cases "if this came from provider X." This is what makes the market-data and estimates vendor decisions (still open — see [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks)) a contained swap later: components are written against `MarketDataProvider`/`AnalystEstimateProvider`'s shapes, not a specific vendor's response format.
- **Interface segregation**: feature `types.ts` exposes narrow view-model types (`HoldingRow`, `ThesisListItem`) distinct from the full Prisma model — a `HoldingsTable` component depends on exactly the fields it renders, not the entire `Holding` + relations graph.
- **Dependency inversion**: components never import a `providers/*` adapter directly; they receive already-normalized data from `server/queries.ts`, which is the only layer that knows which concrete provider is in use.

## 6. Mobile responsiveness

- Tailwind mobile-first breakpoints throughout; no separate mobile components/routes.
- Data-dense views (`HoldingsTable`, `MetricsGrid`, filings lists) have an explicit responsive strategy decided per component, not left implicit: tables collapse to stacked cards below `md`, using the same `shared/components/data-table` config (a `mobileCardRenderer` render prop) rather than a second parallel component.
- Charts (`AllocationChart`, `PerformanceChart`, `RatioTrendChart`, `EstimatesTrendChart`) are built container-responsive (`ResizeObserver`-based sizing) from the start, not fixed-width — a chart hardcoded to a desktop width is treated as a bug, not a follow-up.
- shadcn/ui's primitives are already accessible/responsive-friendly; the discipline is in not overriding that with fixed dimensions in feature components.

## 7. Design system baseline

shadcn/ui + Tailwind tokens (`tailwind.config.ts` theme extension) define the only source of color/spacing/typography values. Feature components consume design tokens (`bg-primary`, `text-muted-foreground`, spacing scale) — no ad hoc hex values or magic pixel numbers in feature code. Dark mode is supported at the token level from day one (shadcn's default), not retrofitted.
