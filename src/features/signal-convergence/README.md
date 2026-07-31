# signal-convergence

Research tool that surfaces companies where government contract awards, SEC insider transactions, and congressional trade disclosures appear together in the same time window. See the in-app **Methodology** tab (`/signal-convergence/methodology`) for the user-facing explanation of the scoring model and its limitations — this doc is the engineering-facing version.

**Not investment advice.** A high Evidence Score means multiple public sources point at the same company in the same window — it is not a rating, not a return prediction, and not evidence of access to non-public information.

## Architecture

Provider-interface pattern, same as every other external data source in this app (`src/shared/contracts/`):

| Contract | Provider | Status |
|---|---|---|
| `insider-transactions-provider.ts` | `providers/sec-insider` | **Real** — SEC EDGAR Forms 3/4/4-A/5/5-A, ownership XML parsed with `fast-xml-parser` |
| `government-contracts-provider.ts` | `providers/usaspending` | **Real** — USAspending.gov `/search/spending_by_award/` + `/transactions/` |
| `congressional-transactions-provider.ts` | `providers/congress` | **Not live** — `ManualCongressImportProvider` (real CSV import) + a clearly-labeled sample fixture. See "Congressional data" below. |
| Market data | reuses `@/features/market-data`'s existing Finnhub provider | **Real** — no new integration |

`PublicCompany`/`MarketPriceSnapshot` from a typical spec for this kind of feature are **not** new tables — the existing `Company` and `PriceSnapshot` models already cover that ground and are reused directly.

### Data flow

1. **Ingestion** (`server/ingestion.ts`) fetches from a provider, resolves each event to a `Company` (via `server/entity-resolution.ts`), and upserts into `GovernmentContractEvent`/`InsiderTransactionEvent`/`CongressionalTransactionEvent`. Every run is tracked in `SourceIngestionRun`/`SourceIngestionError` — no silent failures.
2. **Scoring** (`lib/scoring.ts`) is pure and stateless: given a company's events in a window, it returns an Evidence Score (0–100) with per-component breakdown and real explanations. `server/queries.ts` computes this fresh per request (this app's whole data volume is small enough that this is fast) and writes a `SignalSnapshot` row as a side effect, which is what will feed Phase 3's historical-performance view.
3. **UI** (`components/`, `src/app/(app)/signal-convergence/`) reads the query layer — no business logic in components.

## Entity resolution

Government contracts and congressional disclosures report a company by **name**, not a ticker. `server/entity-resolution.ts`:

- `resolveCompanyByCik` — exact, since Form 3/4/5 filings always carry the issuer's real CIK.
- `resolveCompanyByName` — tries exact `Company.name`, a verified `CompanyAlias`, an unverified `CompanyAlias`, then a normalized-name match (`lib/normalize-company-name.ts` strips legal suffixes/punctuation). Returns `null` below `AUTO_ACCEPT_CONFIDENCE` (0.85) rather than forcing a match.
- Anything that doesn't resolve confidently lands in `EntityResolutionReview` (queue), visible on the **Data Health** tab. Confirming a review also writes a verified `CompanyAlias`, so the same name resolves automatically on every future run.

## Environment variables

Add to `.env` (see `.env.example` for the full block):

```bash
SEC_EDGAR_USER_AGENT="Your App research@yourdomain.com"   # required by SEC's fair-access rules
CRON_SECRET="<random string>"                              # also set in Vercel project settings — enables the cron trigger
```

No new API key is required for USAspending (public, unauthenticated) or the market-data reuse (uses the existing `FINNHUB_API_KEY`).

## Running ingestion locally

```bash
npx tsx -r dotenv/config -r tsconfig-paths/register - <<'EOF'
import { ingestAllSignalSources } from "@/features/signal-convergence/server/ingestion";
ingestAllSignalSources().then((r) => console.log(r));
EOF
```

Or, once signed in, click **Refresh now** on `/signal-convergence` — same code path (`server/actions.ts#triggerManualSignalRefresh`).

**On the very first run**, `ingestAllSignalSources()` has no prior successful run to compute an incremental `since` from, so it falls back to a 90-day lookback per source. A true one-time full historical backfill (what was actually run to seed this feature's real data) calls `ingestInsiderTransactions()`/`ingestGovernmentContracts()` directly with no `since` at all — expect this to take a while (SEC EDGAR rate-limits aggressively enough in practice that ~30 companies' full filing histories took on the order of 10+ minutes even with retry-with-backoff).

## Refresh schedule

This app has no background-job/scheduler system (confirmed: no Inngest, no queue — every other feature uses on-demand DB-first caching). Vercel Cron (`vercel.json`, `src/app/api/cron/signal-convergence/route.ts`) is the zero-new-dependency option, since Vercel is this app's actual deploy target. Currently configured for once daily (`0 6 * * *`) — Vercel Cron schedules are static config, not env-var-configurable at runtime, which is a real platform constraint, not an oversight.

## How to manually import congressional data

House/Senate disclosure sites have no stable, developer-friendly API, and this feature does not scrape past access controls or rate limits — see the Methodology tab for the full reasoning. Real congressional data only ever enters this app through:

```ts
import { importCongressionalCsv } from "@/features/signal-convergence/server/import-congress";
await importCongressionalCsv(csvText);
```

Expected CSV columns: `politicianName,chamber,state,party,owner,assetNameDisclosed,transactionType,transactionDate,filingDate,reportedRange,filingUrl,externalId`. `chamber` is `HOUSE`/`SENATE`; `owner` is `SELF`/`SPOUSE`/`DEPENDENT`/`JOINT`/`UNKNOWN`; `transactionType` is `PURCHASE`/`SALE`/`EXCHANGE`/`UNKNOWN`; dates are `YYYY-MM-DD`; `reportedRange` is a real disclosure bucket string like `"$1,001 - $15,000"` (parsed by `lib/parse-amount-range.ts`); `externalId` must be unique per source row (it's the dedup key). Every row is validated — a bad row is skipped and reported, not silently dropped or left to crash the whole import.

For UI-driven demo/dev data without a real CSV, `providers/congress/sample-fixture.ts` has two clearly-fake rows. It is never wired into the real ingestion path — `sourceName`/`isLiveOfficialSource` are threaded through every record specifically so the UI can never present it as live.

## How to review unresolved mappings

`/signal-convergence/data-health` lists every `PENDING` `EntityResolutionReview` row with its suggested match (if any) and confidence, plus a dropdown of every tracked company. **Confirm** links it to whichever company is selected (the system's suggestion by default, or any other company picked from the dropdown) and writes a verified `CompanyAlias` (teaches the system that name going forward). **Reject** marks it closed with no link.

## Performance evaluation (Phase 3)

`/signal-convergence/performance` answers "how did prior Evidence Scores line up with what actually happened to price afterward" using only real data already on file — no backtest assumptions, no simulated prices. `server/evaluation.ts#getSignalPerformanceHistory`:

1. Reads real `SignalSnapshot` rows (the same rows `getSignalCandidates` already writes as a side effect of normal Overview-page usage) that are at least 14 days old (`EVALUATION_HORIZON_DAYS`) — a forward return can't be measured before that much time has actually passed.
2. Dedupes to one snapshot per (company, window, calendar day) — repeated page loads write a new row every time, and evaluating every one would over-weight companies whose pages just got refreshed more often, not companies with more actual signal days.
3. Fetches real historical closes via the existing market-data provider's `getHistoricalPrices` (Finnhub, with the Yahoo Finance fallback already used by the price-history chart — see that provider's own comment) for the snapshot date and 14 days later. A missing bar (market holiday, no data yet) leaves that price `null` — never interpolated or guessed.
4. Buckets by score range (0-29 / 30-59 / 60-100, matching the candidate table's own badge thresholds) and reports an average forward return only once at least 3 evaluable snapshots exist in that bucket (`lib/evaluation.ts#MIN_SAMPLE_SIZE_FOR_AVERAGE`) — otherwise it honestly shows "Insufficient data" rather than a 1-sample average dressed up as a statistic.

Verified live (2026-07-31) end-to-end with a temporary backdated snapshot: real AAPL entry/exit closes 14 days apart via the Yahoo fallback (Finnhub 403'd as expected on the free tier), a correct forward-return calculation, and the bucket correctly suppressing its average at n=1. This is a small, continuously-growing dataset from real usage, not a validated backtest — the page says so explicitly.

## Custom date ranges

The Overview page's window control offers the fixed 7/30/90-day buckets plus a "Custom range" option (`?from=YYYY-MM-DD&to=YYYY-MM-DD`, replacing `?window=`). `lib/timeframe.ts#resolveTimeframe` is the single place both forms get normalized into `{ since, asOf, windowDays }`: a fixed window's `asOf` is always real "now" (unchanged behavior), while a custom range's `asOf` is its own `to` date — recency decay and "is this evidence still fresh" only make sense relative to the end of the window actually being evaluated, not real now, which matters once a range is fully in the past. `windowDays` (a real day-count for a custom range, not a fabricated bucket) is what `SignalSnapshot` stores, which is exactly the mechanism Phase 3's evaluation view reads.

## Score methodology

See the in-app Methodology tab for the user-facing explanation, or `lib/scoring.ts`'s own doc comments for the exact weights and rationale. Short version: insider evidence (max 35, open-market purchases only), government-contract evidence (max 30, new awards/funded modifications only — never a de-obligation or $0 correction), congressional evidence (max 20, purchases only, penalized for late disclosure), convergence bonus (max 15, scaled by underlying signal strength, not a flat bonus for merely touching 2+ categories). Recency decay and confidence penalties apply throughout.

## Replacing a provider

Every source sits behind an interface in `src/shared/contracts/`. To replace USAspending, write a new module implementing `GovernmentContractsProvider` and swap the import in `server/ingestion.ts` — scoring, entity resolution, and the UI never change. Same pattern for insider transactions or congressional data (see the adapter-point doc comment on `CongressionalTransactionsProvider`).

## Running tests

```bash
npx vitest run src/features/signal-convergence
```

Unit tests (pure logic, no live calls): insider classification, contract-action classification, company-name normalization, amount-range parsing, manual-CSV validation, scoring (recency decay, confidence penalties, the spec's own worked-example shape). Integration tests (real Supabase Postgres, real fixture data, no live external APIs — same reasoning as `src/lib/db/rls.test.ts`): entity resolution against real `Company` rows already in the database.

## Known limitations (Phase 1)

- **Congressional data is not live** — this is Phase 2 as originally scoped, gated on either an authorized third-party provider or confirming a permitted official retrieval method. Never silently presented as current; every congressional event and the Data Health tab carry an explicit source-kind label.
- **The candidate table's client-side filters are a real subset**, not the spec's full exhaustive list: search, minimum score, minimum confidence, category (via the Venn diagram), sector, and purchase-only are implemented, alongside a server-side custom date-range window (see below).
