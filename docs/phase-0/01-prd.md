# Product Requirements Document

## 1. Vision

StockLens is a plug-and-play investment research and monitoring platform. A user connects their real brokerage account (read-only) or manually builds a portfolio of **any publicly traded company**, then sees not just price and P&L but the full picture behind each position: financial trends, forward expectations, valuation, company-specific KPIs, catalysts, risks, and thesis status — in one place. Nothing in the product is specific to any single company, sector, or exchange; the entire data model resolves around a generic `Company` entity keyed by ticker/CIK.

## 2. Problem

Retail and semi-professional investors currently stitch together 5-6 tools to do this: a brokerage app for positions, a financial data terminal for fundamentals, an estimates/consensus service for forward expectations, a notes app for thesis, SEC EDGAR for disclosures, and a price alert app. None of them connect a real position to the full research picture behind it, so monitoring a holding means manually checking several places for whether anything material has changed.

## 3. Target users

| Persona | Description | Primary need |
|---|---|---|
| Self-directed retail investor | Holds 5-30 positions, primarily at one brokerage (Robinhood first) | Connect once, see everything relevant about each holding without leaving the app |
| Serious/semi-pro individual investor | Writes real theses, tracks catalysts, monitors forward estimates and company-specific KPIs | Structured thesis lifecycle + real forward-looking data, not just historical filings |
| (Future) Small investment club / advisor | Manages theses collaboratively | Shared workspace, comments, permissions |

V1 targets the first two personas as single-user accounts. The third persona is the reason the tenancy model exists from day one (see [02-architecture.md](./02-architecture.md)).

## 4. Non-goals (explicit)

- Not a trade execution platform. Robinhood integration is **read-only**, permanently — see [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary). No trading, transfer, or account-modification capability exists anywhere in the codebase, not just "unused."
- Not a real-time Level 2 trading terminal. Price data is for research context, not execution decisions.
- Not tied to Oracle, or any single company/sector — every fixture, demo, and test dataset in the product must use at least two unrelated tickers to prevent accidental coupling.
- Not (in V1) a multi-user collaboration tool, though the schema won't block adding it later.
- Not a tax/accounting product. Cost-basis tracking is for analytics, not IRS-grade lot accounting (no wash-sale logic in V1).
- **Not a source of current prices, analyst estimates, or forward-looking metrics from SEC EDGAR.** EDGAR supplies historical reported financials and filings only — it has no live quotes, no consensus estimates, no guidance. Anything forward-looking or price-current requires a separate data vendor, explicitly called out wherever it applies rather than implied to be free. See [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks).

## 5. Feature scope by phase

Reordered from the original plan: read-only Robinhood sync and forward-looking company monitoring are MVP-critical, not deferred behind manual data entry. See [11-implementation-plan.md](./11-implementation-plan.md) for the full phase breakdown and a requirement-by-requirement mapping from the original plan.

### MVP (Phases 2-6)
- Auth (email/password + OAuth via Supabase Auth) — done
- Company research (any ticker, via SEC EDGAR) — done
- **Read-only Robinhood connect + sync**: real accounts and positions, no manual portfolio required first
- **Expanded reported fundamentals**: revenue, margins, cash flow, capital structure, dilution, returns — not just the ~6-field MVP subset EDGAR made trivial
- **Market data + valuation**: current price, market cap, EV, and the standard valuation ratio set (requires a market-data vendor — see [8. Constraints](#8-constraints-and-assumptions))
- **Forward-looking data**: consensus estimates, revisions, guidance, surprise history (requires an estimates vendor — see constraints)
- **Company-specific KPI framework**: industry-templated KPIs (SaaS, banks, retail, semiconductors, subscription, marketplaces), filing-derived/data-provider/manually-sourced
- **Thesis, catalysts, risks**: investment thesis per holding with conviction/target price/status, tracked catalysts and risks, a monitoring rollup per holding

### Phase 7 — Alternative ingestion
- Manual portfolio creation, manual holding/transaction entry
- CSV import of transactions/holdings (broker-agnostic column mapping)
- Both render through the same holding-detail monitoring view Robinhood-synced positions use — one code path regardless of how a position entered the system

### Phase 8 — Analytics, earnings review, alerts
- Portfolio analytics: allocation by position/sector, unrealized/realized gain-loss, performance chart
- Structured earnings review notes (distinct from the forward-looking estimate/date data in the MVP — this is the user's post-earnings journal)
- Alerts: price threshold, new filing published, upcoming earnings, thesis "needs review" nudge, notification delivery

### Phase 9 — AI + SaaS expansion
- AI-generated summaries: filing summary, earnings call summary, thesis-drift detection
- Multi-seat workspaces (teams/investment clubs), roles (owner/editor/viewer)
- Public/shareable read-only thesis pages (optional, user-opt-in)
- Billing (Stripe) for SaaS tiers

## 6. Golden path (V1)

1. **Sign in**
2. **Connect Robinhood** — read-only, from `/settings/integrations/robinhood`. No manual portfolio required first; connecting creates its own `Portfolio` (`source: ROBINHOOD_SYNC`).
3. **Run a read-only sync** — real positions and transactions land as `Transaction`/`Holding` rows, the same tables manual entry and CSV import also write to.
4. **See real accounts and positions** — a holdings table rendered from the sync.
5. **Open a holding** and see, in one place:
   - Financial trends (expanded reported fundamentals, historical)
   - Forward expectations (consensus estimates, revisions, guidance)
   - Valuation (current multiples, historical percentile, peer comparison)
   - Company-specific KPIs (industry-templated)
   - Catalysts and risks being tracked
   - Thesis status (on-track / watch / broken / unreviewed)

Manual portfolio creation and CSV import remain available as alternative entry points (Phase 7) — never a prerequisite for step 2.

## 7. Success metrics (product-level, not engineering KPIs)

- Time from signup to a connected, synced Robinhood account with ≥1 real holding (activation).
- % of synced holdings opened at least once to view the monitoring detail (engagement depth).
- % of holdings with a thesis attached, and thesis revisit rate after a triggering estimate revision, guidance change, or filing (the core retention loop).

## 8. Constraints and assumptions

- No official Robinhood public API — integration depends on an unofficial/session-based channel and must be read-only by construction (see security model). This is now MVP-critical, not a deferred nice-to-have, so its fragility is a launch risk to actively manage, not a Phase 3 concern.
- SEC EDGAR (`data.sec.gov`) is free, has no auth, is rate-limited, and requires a compliant User-Agent — the source of truth for filings and historical reported fundamentals only.
- **Market data (current price, shares outstanding) and analyst estimates/guidance require a paid vendor.** This is a real, unresolved dependency blocking Phase 3's `MarketDataProvider` and all of Phase 4 — not something V1 works around by leaning on free data, because no adequate free source exists for consensus estimates. A vendor decision (e.g. Financial Modeling Prep, Intrinio, Benzinga, or similar) is required before those phases can ship for real.
- Company-specific KPIs (SaaS NRR, retail same-store sales, etc.) are rarely standardized/XBRL-tagged — genuinely automated filing-derived extraction is an AI-extraction problem, not a data-fetch problem, and is scoped as a stretch goal within Phase 5, not a launch guarantee. Manual and data-provider-sourced KPIs are the reliable path for V1.
- Single Postgres instance (Supabase) for all tenants; no per-tenant database sharding in V1 — enforced isolation is via `workspace_id` + Row Level Security, not physical separation.
