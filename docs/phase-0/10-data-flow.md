# Data Flow

Sequence diagrams for the flows that touch the most architectural surface (background jobs, external providers, security boundaries).

## 1. CSV import

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
        J->>DB: upsert Transaction (unique on portfolioId+externalId)
    end
    J->>DB: recompute Holding aggregates for affected companies
    J->>DB: update CsvImportJob (status=COMPLETED, rowsSucceeded, rowsFailed, errorDetail)
    UI->>SA: poll/subscribe job status
    SA-->>UI: status update → show results + row-level errors
```

Key property: the web request only uploads and enqueues — all parsing/writing happens in the job, so a large or malformed file can't hang a serverless function past its execution limit.

## 2. Robinhood sync (read-only)

```mermaid
sequenceDiagram
    actor U as User
    participant UI as Settings UI
    participant SA as Server Action
    participant Vault as Secret Store
    participant Cron as Vercel Cron
    participant J as Inngest Job
    participant RH as Robinhood (read-only adapter)
    participant DB as Postgres (Prisma)

    U->>UI: Connect brokerage
    UI->>SA: initiateConnection()
    SA->>Vault: store credential reference (never in Postgres)
    SA->>DB: create BrokerageConnection (status=CONNECTED, scopes=[read:*])

    Cron->>J: trigger brokerage-sync.run (scheduled, e.g. nightly)
    J->>DB: list active BrokerageConnections
    loop each connection
        J->>Vault: fetch live credential (just-in-time)
        J->>RH: listPositions() / listTransactions()  %% read-only interface — no write method exists
        RH-->>J: positions, transactions
        J->>DB: upsert Transaction rows (unique on externalId — idempotent)
        J->>DB: recompute Holding aggregates
        J->>DB: update BrokerageConnection.lastSyncedAt
    end
```

No path in this diagram accepts a user instruction and turns it into a call against Robinhood — sync is a scheduled pull of read endpoints only, matching `ROBINHOOD_MCP_SECURITY_PLAN.md`.

## 3. AI filing summary generation

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

## 4. Alert evaluation and delivery

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

## 5. Thesis update triggered from an earnings review

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
    SA->>DB: update Thesis (summary/conviction/targetPrice, status=ACTIVE)
    SA->>DB: create EarningsReview (spawnedRevisionId = new revision id)
    SA->>DB: commit transaction
    SA-->>UI: revalidate thesis + earnings pages
```

Single DB transaction because `ThesisRevision` + `Thesis` + `EarningsReview` must be consistent — a partial write here (revision created but thesis not updated, or vice versa) would corrupt the thesis history, so this is one of the few write paths that explicitly wraps multiple Prisma calls in `prisma.$transaction`.
