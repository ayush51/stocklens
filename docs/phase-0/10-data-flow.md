# Data Flow

Sequence diagrams for the flows that touch the most architectural surface (background jobs, external providers, security boundaries).

**Revision note**: Robinhood sync is now the MVP's primary ingestion flow (§1) rather than a later addition — its diagram gained the kill-switch check, per-run audit logging, and auto-created-portfolio detail that came with promoting it to Phase 2. New: the holding monitoring rollup (§5), the golden path's "open a holding" step, and a generalized external-data-ingestion pattern (§4) that Phase 3/4/5's fundamentals/estimates/KPI jobs all follow rather than each getting a near-identical diagram.

## 1. Robinhood connect + sync (read-only, MVP-critical)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Settings UI
    participant SA as Server Action
    participant Vault as Secret Store
    participant DB as Postgres (Prisma)
    participant Cron as Vercel Cron
    participant J as Inngest Job
    participant RH as Robinhood (read-only adapter)

    U->>UI: Connect Robinhood
    UI->>SA: initiateConnection()
    SA->>Vault: store credential reference (never in Postgres)
    SA->>DB: create Portfolio (source=ROBINHOOD_SYNC) — auto-created, no manual portfolio required first
    SA->>DB: create BrokerageConnection (status=CONNECTED, scopes=[read:positions, read:transactions])
    SA-->>UI: connected — offer "sync now"

    alt user clicks "sync now" (manual trigger, or later: Cron fires on schedule)
        UI->>J: trigger brokerage-sync.run {connectionId}
    else
        Cron->>J: trigger brokerage-sync.run (scheduled sweep, all active connections)
    end

    J->>J: check BROKERAGE_SYNC_ENABLED kill switch
    alt kill switch off
        J->>DB: create AuditLog (action=BROKERAGE_SYNC_BLOCKED_BY_KILL_SWITCH)
        J-->>J: exit — no credential fetched, no adapter call made
    else kill switch on
        J->>DB: create AuditLog (action=BROKERAGE_SYNC_RUN, status=started)
        J->>Vault: fetch live credential (just-in-time)
        J->>RH: getAccountSummary() / listPositions() / listTransactions()
        Note over J,RH: read-only interface — no write method exists to call, even if the job wanted to
        RH-->>J: account summary, positions, transactions
        J->>DB: upsert Transaction rows (unique on portfolioId+externalId — idempotent, safe to retry)
        J->>DB: recompute Holding aggregates
        J->>DB: update BrokerageConnection.lastSyncedAt
        J->>DB: update AuditLog (status=completed, rowsSynced=N)
    end
```

No path in this diagram accepts a user instruction and turns it into a call against Robinhood — sync is a scheduled/triggered pull of three read endpoints only, matching `ROBINHOOD_MCP_SECURITY_PLAN.md` and [09-security-model.md §3](./09-security-model.md#3-robinhood-integration-boundary).

## 2. CSV import (alternative ingestion path, Phase 7)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as CSV Import UI (Client)
    participant SA as Server Action
    participant ST as Supabase Storage
    participant J as Inngest Job
    participant DB as Postgres (Prisma)

    U->>UI: Upload CSV, map columns
    UI->>SA: submitImport(file, columnMapping)
    SA->>ST: store raw file
    SA->>DB: create CsvImportJob (status=PENDING)
    SA->>J: enqueue csv-import.process {jobId}
    SA-->>UI: jobId (redirect to progress view)

    J->>ST: fetch raw file
    J->>J: parse rows, validate (zod), typed coercion (reject, don't guess)
    loop each valid row
        J->>DB: upsert Transaction (unique on portfolioId+externalId — same idempotency mechanism as Robinhood sync)
    end
    J->>DB: recompute Holding aggregates for affected companies
    J->>DB: update CsvImportJob (status=COMPLETED, rowsSucceeded, rowsFailed, errorDetail)
    UI->>SA: poll/subscribe job status
    SA-->>UI: status update → show results + row-level errors
```

Key property: the web request only uploads and enqueues — all parsing/writing happens in the job, so a large or malformed file can't hang a serverless function past its execution limit. Writes go through the same `Transaction`/`Holding` tables Robinhood sync uses — a holding's monitoring view (§5) doesn't know or care which ingestion path produced it.

## 3. Company research: on-demand resolve-and-cache (companies, filings, financial-metrics — as built)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Company Page (Server Component)
    participant Q as server/queries.ts
    participant DB as Postgres (app_user, RLS-scoped)
    participant P as Provider (SEC EDGAR)
    participant SVC as Postgres (service_role_app)

    U->>UI: Open /companies/[ticker]
    UI->>Q: getOrResolveCompanyByTicker(ticker)
    Q->>DB: SELECT Company WHERE ticker = ?
    alt found
        DB-->>Q: existing row
    else not found
        Q->>P: resolve ticker (EDGAR ticker list)
        P-->>Q: CIK, name
        Q->>SVC: upsert Company (service client — app_user has no INSERT grant on global reference data)
        SVC-->>Q: created row
    end
    Q-->>UI: Company

    UI->>Q: getFinancialStatementsForCompany(companyId, cik) / getFilingsForCompany(...)
    Q->>DB: SELECT cached rows
    alt cache empty
        Q->>P: fetch live (XBRL company-facts / submissions API)
        P-->>Q: raw data
        Q->>SVC: createMany (service client, skipDuplicates)
        Q->>DB: re-SELECT the now-populated rows
    end
    Q-->>UI: statements / filings
```

This is the pattern already implemented for `companies`/`filings`/`financial-metrics` — DB-first, populate-once-then-cache, writes through `service_role_app` since these are global reference tables `app_user` can't write to. Phase 3's expanded `FundamentalDataProvider`, and Phase 4/5's `AnalystEstimateProvider`/`CompanyKPIProvider`, extend this exact same pattern rather than inventing a new one — see §4 for the version of this that runs as a scheduled background job instead of on-demand.

## 4. Scheduled external-data ingestion (market data, estimates, KPIs — Phases 3-5)

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant J as Ingestion Job (Inngest)
    participant Vendor as Vendor (market data / estimates / KPI source)
    participant SVC as Postgres (service_role_app)

    Cron->>J: trigger (e.g. market-data.refresh, estimates.refresh, kpis.refresh)
    J->>SVC: list Companies needing refresh (e.g. held by any active Portfolio, or all — cadence TBD per vendor cost)
    loop each company
        J->>Vendor: fetch current data
        Vendor-->>J: price/shares-outstanding, or estimates snapshot, or KPI values
        J->>SVC: upsert PriceSnapshot / AnalystEstimate / CompanyKPIValue (service client — global reference data)
    end
```

One generic shape for all three Phase 3-5 ingestion jobs, differing only in which vendor and which table. `AnalystEstimate` writes are always inserts (new `asOfDate` row), never updates — that's what makes revision-over-time queries just a read over existing rows. Requires the vendor decisions flagged in [02-architecture.md §6](./02-architecture.md#6-key-architectural-risks) before this can run against real data.

## 5. Opening a holding: the monitoring rollup (Phase 6, golden path step 5)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Holding Detail Page (Server Component)
    participant HQ as portfolios/server/queries.ts
    participant FQ as financial-metrics/server/queries.ts
    participant EQ as analyst-estimates/server/queries.ts
    participant KQ as company-kpis/server/queries.ts
    participant TQ as thesis/server/queries.ts
    participant DB as Postgres (app_user, RLS-scoped)

    U->>UI: Open /portfolios/[id]/holdings/[holdingId]
    UI->>HQ: getHolding(holdingId) — workspace-scoped
    HQ->>DB: SELECT Holding + Company
    DB-->>HQ: holding, company

    par independent reads, no cross-dependency
        UI->>FQ: getFinancialTrend(companyId) + computeValuation(companyId)
        FQ->>DB: SELECT FinancialStatement, PriceSnapshot
        FQ-->>UI: trend states (accelerating/stable/decelerating), valuation ratios + historical percentile
    and
        UI->>EQ: getForwardExpectations(companyId)
        EQ->>DB: SELECT AnalystEstimate, Guidance
        EQ-->>UI: consensus, revision direction, guidance vs. consensus
    and
        UI->>KQ: getKPIs(companyId)
        KQ->>DB: SELECT CompanyMetricDefinition (template + override) + CompanyKPIValue
        KQ-->>UI: industry-templated KPI values
    and
        UI->>TQ: getThesisForHolding(holdingId) + getCatalysts(companyId) + getRisks(companyId)
        TQ->>DB: SELECT Thesis, Catalyst, Risk (workspace-scoped)
        TQ-->>UI: thesis status, tracked catalysts, tracked risks
    end

    UI->>UI: assemble HoldingMonitoringSummary (component composition, no additional query — see docs/phase-0/08-component-architecture.md)
    UI-->>U: financial trends, forward expectations, valuation, KPIs, catalysts, risks, thesis status
```

The four reads run independently (no query depends on another's result) and each degrades gracefully on its own — a missing estimates vendor integration means the forward-expectations panel shows "not available yet," not a failed page load for the whole holding. This is also why the calculations live in each feature's own `server/queries.ts` (per [08-component-architecture.md §3](./08-component-architecture.md#3-data-fetching-pattern)) rather than one monolithic "get everything for a holding" function — each piece is independently testable and independently gradable when a data source isn't ready.

## 6. AI filing summary generation (Phase 9)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Filing Detail Page
    participant SA as Server Action
    participant DB as Postgres (Prisma)
    participant J as Inngest Job
    participant AI as AI Provider (Claude)

    U->>UI: Open filing detail
    UI->>DB: (Server Component) fetch SecFiling + existing AISummary if present
    alt summary cached (inputHash matches)
        DB-->>UI: return cached AISummary.content
    else no cached summary
        UI->>SA: requestSummary(filingId)
        SA->>J: enqueue ai-summary.generate {subjectType: SEC_FILING, filingId}
        SA-->>UI: pending state
        J->>DB: fetch filing document text
        J->>AI: summarize(delimited filing text, prompt v{n})  %% filing text treated as data, not instructions
        AI-->>J: summary content
        J->>DB: upsert AISummary (unique on subjectType+subjectId+inputHash)
        UI->>UI: revalidate / poll → render summary
    end
```

Cache key (`inputHash`) is derived from filing content + prompt version + model id — a prompt/model upgrade naturally invalidates old summaries without an explicit migration step.

## 7. Alert evaluation and delivery (Phase 8)

```mermaid
sequenceDiagram
    participant Cron as Vercel Cron
    participant J as Inngest Job
    participant DB as Postgres (Prisma)
    participant Mail as Email Provider

    Cron->>J: trigger alerts.evaluate (scheduled sweep)
    J->>DB: list active AlertRules (partial index: active=true)
    loop each rule
        alt type = PRICE_ABOVE / PRICE_BELOW
            J->>DB: fetch latest PriceSnapshot for rule.companyId
        else type = NEW_FILING
            J->>DB: check for SecFiling with filedAt after last check
        else type = UPCOMING_EARNINGS
            J->>DB: check EarningsEvent within config.daysBefore window
        else type = THESIS_STALE
            J->>DB: check Thesis.updatedAt against staleness threshold
        end
        alt condition met
            J->>DB: create AlertEvent (deliveryStatus=PENDING)
            J->>Mail: send notification
            Mail-->>J: delivery result
            J->>DB: update AlertEvent.deliveryStatus
        end
    end
```

## 8. Thesis update triggered from an earnings review (Phase 8)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Earnings Review Form (Client)
    participant SA as Server Action
    participant DB as Postgres (Prisma)

    U->>UI: Write review notes, check "this affects my thesis"
    UI->>SA: submitEarningsReview(eventId, notes, affectsThesis=true, updatedThesisFields)
    SA->>DB: begin transaction
    SA->>DB: create ThesisRevision (trigger=EARNINGS_REVIEW, snapshot of new fields)
    SA->>DB: update Thesis (summary/conviction/targetPrice, status=ON_TRACK)
    SA->>DB: create EarningsReview (spawnedRevisionId = new revision id)
    SA->>DB: commit transaction
    SA-->>UI: revalidate thesis + earnings pages
```

Single DB transaction because `ThesisRevision` + `Thesis` + `EarningsReview` must be consistent — a partial write here (revision created but thesis not updated, or vice versa) would corrupt the thesis history, so this is one of the few write paths that explicitly wraps multiple Prisma calls in `prisma.$transaction`. (`status=ON_TRACK` reflects the Phase 6 `ThesisStatus` remap — see [05-prisma-schema.md](./05-prisma-schema.md).)
