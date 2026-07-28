# Product Requirements Document

## 1. Vision

ThesisTrack is a plug-and-play investment research and thesis-tracking platform. A user connects or manually builds a portfolio of **any publicly traded company**, then tracks not just price and P&L but *why* they hold each position — the thesis, the catalysts, the filings, the earnings history — in one place. Nothing in the product is specific to any single company, sector, or exchange; the entire data model resolves around a generic `Company` entity keyed by ticker/CIK.

## 2. Problem

Retail and semi-professional investors currently stitch together 4-5 tools to do this: a brokerage app for positions, a notes app or spreadsheet for thesis, SEC EDGAR or a filings aggregator for disclosures, an earnings calendar site, and a price alert app. None of them connect a position to the reasoning behind it, so theses go stale silently and filings/earnings that should prompt a thesis review get missed.

## 3. Target users

| Persona | Description | Primary need |
|---|---|---|
| Self-directed retail investor | Holds 5-30 positions across one or more brokerages | Consolidated view + "did anything change that should make me revisit this?" |
| Serious/semi-pro individual investor | Writes real theses, tracks catalysts, reviews earnings quarterly | Structured thesis lifecycle + filing/earnings linkage |
| (Future) Small investment club / advisor | Manages theses collaboratively | Shared workspace, comments, permissions |

V1 targets the first two personas as single-user accounts. The third persona is the reason the tenancy model exists from day one (see [02-architecture.md](./02-architecture.md)).

## 4. Non-goals (explicit)

- Not a trade execution platform. Robinhood integration is **read-only**, permanently — see [09-security-model.md](./09-security-model.md#robinhood-integration-boundary).
- Not a real-time Level 2 trading terminal. Price data is for context, not execution decisions.
- Not tied to Oracle, or any single company/sector — every fixture, demo, and test dataset in the product must use at least two unrelated tickers to prevent accidental coupling.
- Not (in V1) a multi-user collaboration tool, though the schema won't block adding it later.
- Not a tax/accounting product. Cost-basis tracking is for analytics, not IRS-grade lot accounting (no wash-sale logic in V1).

## 5. Feature scope by phase

### Phase 1 — MVP (single-player, manual data)
- Auth (email/password + OAuth via Supabase Auth)
- Manual portfolio creation, manual holding entry
- CSV import of transactions/holdings (broker-agnostic column mapping)
- Company research page for any ticker: profile, key financial metrics, filings list (from SEC EDGAR)
- Investment thesis: create/edit/version a thesis per holding, with conviction level and target price
- Portfolio analytics: allocation by position/sector, unrealized/realized gain-loss, basic performance chart

### Phase 2 — Sync, earnings, alerts
- Robinhood portfolio sync (read-only), holdings + transactions only
- Earnings calendar per holding + structured earnings review notes tied to each report
- Alerts: price threshold, new filing published, upcoming earnings, thesis "needs review" nudge
- Notification delivery (email first; in-app second)

### Phase 3 — AI + SaaS expansion
- AI-generated summaries: filing summary, earnings call summary, thesis-drift detection ("this filing contradicts your thesis's assumption about X")
- Multi-seat workspaces (teams/investment clubs), roles (owner/editor/viewer)
- Public/shareable read-only thesis pages (optional, user-opt-in)
- Billing (Stripe) for SaaS tiers

## 6. Core user journeys (V1)

1. **Onboard**: sign up → create first workspace (auto) → create a portfolio (manual or CSV import) → land on portfolio dashboard.
2. **Research a company**: search any ticker → view profile/metrics/filings → click "Add thesis" → write thesis, set conviction + target price → thesis attaches to that company (and to a holding if one exists).
3. **Track after adding**: portfolio dashboard shows allocation + performance; each holding card shows thesis status (fresh / stale / needs review once Phase 2 alerts land).
4. **Import history**: upload a CSV export from any brokerage → map columns once → transactions and current holdings are reconciled into a portfolio.

## 7. Success metrics (product-level, not engineering KPIs)

- Time from signup to first portfolio with ≥1 holding and ≥1 thesis (activation).
- % of holdings that have an associated thesis (engagement depth).
- Thesis revisit rate after a triggering filing/earnings event, once Phase 2 ships (the core retention loop).

## 8. Constraints and assumptions

- No official Robinhood public API — integration depends on an unofficial/session-based channel and must be read-only by construction (see security model). This is a known fragility risk, not a blocker for V1 (Robinhood sync is Phase 2, not MVP).
- SEC EDGAR (`data.sec.gov`) is free and has no auth but is rate-limited and requires a compliant User-Agent — fine as the filings source of truth.
- Structured financial metrics (revenue, margins, ratios) need a paid/licensed data provider eventually; V1 can derive a usable subset directly from EDGAR's XBRL company-facts API to avoid a hard vendor dependency on day one.
- Single Postgres instance (Supabase) for all tenants; no per-tenant database sharding in V1 — enforced isolation is via `workspace_id` + Row Level Security, not physical separation.
