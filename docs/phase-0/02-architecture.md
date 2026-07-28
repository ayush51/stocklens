# System Architecture

## 1. High-level component diagram

```mermaid
flowchart TB
    subgraph Client["Client (Browser / Mobile Web)"]
        UI["Next.js 15 App Router UI\nReact Server + Client Components"]
    end

    subgraph Vercel["Vercel"]
        RSC["Server Components / Server Actions"]
        API["Route Handlers (app/api/*)"]
        CRON["Vercel Cron\n(scheduled triggers)"]
    end

    subgraph Jobs["Durable Background Jobs (Inngest)"]
        J1["CSV import processor"]
        J2["Robinhood sync (read-only)"]
        J3["Filing/earnings ingestion"]
        J4["AI summary generation"]
        J5["Alert evaluation"]
    end

    subgraph Supabase["Supabase"]
        AUTH["Supabase Auth"]
        PG[("PostgreSQL\n+ Row Level Security")]
        STORAGE["Supabase Storage\n(CSV uploads, cached filing docs)"]
    end

    subgraph External["External Integrations (behind adapters)"]
        SEC["SEC EDGAR\n(submissions + XBRL company facts)"]
        FIN["Financial metrics provider"]
        RH["Robinhood (read-only channel)"]
        AI["AI provider (Claude)"]
        MAIL["Email provider (notifications)"]
    end

    UI <--> RSC
    UI <--> API
    RSC --> PG
    API --> PG
    RSC --> AUTH
    API -->|enqueue| Jobs
    CRON -->|trigger| Jobs

    J1 --> PG
    J1 --> STORAGE
    J2 --> RH
    J2 --> PG
    J3 --> SEC
    J3 --> FIN
    J3 --> PG
    J4 --> AI
    J4 --> PG
    J5 --> PG
    J5 --> MAIL

    Prisma["Prisma ORM"] -.type-safe access.-> PG
    RSC --> Prisma
    API --> Prisma
    Jobs --> Prisma
```

## 2. Component responsibilities

| Component | Responsibility | Why this choice |
|---|---|---|
| **Next.js 15 (App Router)** | UI rendering, routing, Server Actions for same-request mutations, Route Handlers for external-facing/webhook-style endpoints | Co-locates data fetching with components (RSC), matches Vercel's deployment model, first-class TS support |
| **Prisma** | Single source of truth for schema, type-safe query layer, migrations | SOLID: isolates persistence details behind a typed client; no feature module hand-writes SQL |
| **Supabase Postgres** | System of record | Managed Postgres with connection pooling (pgbouncer), Auth, and Storage bundled — avoids standing up three separate vendors |
| **Supabase Auth** | Identity, session/JWT issuance, OAuth providers | Issues the JWT that both the client (Supabase client for RLS-scoped reads, if used) and the server (via `sub` claim) use to identify the user |
| **Supabase Storage** | Raw CSV uploads, cached filing PDFs/HTML | Keeps large blobs out of Postgres rows |
| **Inngest (durable jobs)** | CSV processing, Robinhood sync, filing/earnings ingestion, AI summary generation, alert evaluation | Vercel serverless functions are time-boxed; these jobs are retryable, potentially slow (LLM calls, third-party rate limits), and need step-level retry/observability that a bare `fetch`-in-a-cron does not give you |
| **Vercel Cron** | Time-based triggers (nightly price/metric refresh, daily filing poll, earnings calendar sync, alert sweep) | Native to the hosting platform, no extra infra |
| **SEC EDGAR** | Filings metadata + XBRL structured financial facts | Free, authoritative, no per-vendor lock-in for the filings feature |
| **Financial metrics provider** | Supplemental computed metrics EDGAR doesn't give cleanly (real-time-ish quotes, ratios, sector comps) | Abstracted behind an interface — swappable, not load-bearing for MVP |
| **Robinhood (read-only)** | Portfolio sync source | Same operating boundary as `ROBINHOOD_MCP_SECURITY_PLAN.md`: read-only, credentials never stored in plaintext, no write-capable call path exists in this integration's code at all (not just "unused") |
| **AI provider (Claude)** | Filing/earnings summarization, thesis-drift detection | Called only from background jobs, never inline in a request/response cycle, so latency/cost never blocks page loads |

## 3. Why feature-based architecture (and what it buys us)

Each domain capability (`portfolios`, `theses`, `filings`, `earnings`, `alerts`, `ai-summaries`, `csv-import`, `brokerage-sync`) owns its server logic, types, and UI components in one directory (see [03-folder-structure.md](./03-folder-structure.md)). `app/` stays a thin routing layer that imports from features. This gives us:

- **Single Responsibility**: a feature module changes for one reason (that domain's rules changing), not because routing changed.
- **Open/Closed**: adding `brokerage-sync` for a second broker later means adding a new adapter behind the existing `BrokerageSyncProvider` interface, not touching `portfolios`.
- **Dependency Inversion**: features depend on interfaces (`FilingsProvider`, `MetricsProvider`, `AISummaryProvider`, `BrokerageSyncProvider`) defined in `src/shared/contracts`, and the concrete SEC/Robinhood/Claude implementations are injected at the edge (job handler / route handler), not imported deep inside feature logic. This is what makes "swap the financial data vendor" or "add a second broker" a contained change.
- **Independent testability**: each feature's server logic can be unit-tested against a mocked Prisma client and mocked provider interfaces without booting the whole app.

## 4. Multi-tenancy posture (SaaS-readiness)

V1 ships single-user workspaces, but every tenant-owned table carries a `workspaceId`, and `Workspace` has a `WorkspaceMember` join table from the start (role: `OWNER` for V1, `EDITOR`/`VIEWER` reserved). This means Phase 3's multi-seat teams is a UI + authorization change, not a schema migration touching every table. Physical isolation (per-tenant DB/schema) is explicitly deferred — logical isolation via `workspaceId` + Postgres RLS is sufficient until there's a concrete enterprise/compliance requirement forcing otherwise.

## 5. Environments

| Environment | Purpose | Notes |
|---|---|---|
| `local` | Development | Local `.env`, Supabase local dev stack or a dedicated dev project, Prisma migrations run manually |
| `preview` | Per-PR Vercel preview deployments | Points at a shared Supabase "staging" project; seeded with synthetic multi-ticker data, never real brokerage credentials |
| `production` | Live | Separate Supabase project, separate secrets, Inngest production environment |

## 6. Key architectural risks (flagged now, addressed in later docs)

1. **Robinhood has no official API.** Contained by treating it as a single, isolated, read-only adapter (see [09-security-model.md](./09-security-model.md)) — if it breaks or has to be removed, no other feature depends on it.
2. **Serverless execution limits.** Contained by pushing anything slow/retryable (imports, sync, AI, filing ingestion) into Inngest jobs instead of request-cycle code.
3. **Vendor dependency for financial metrics.** Contained by the `MetricsProvider` interface and by leaning on free EDGAR XBRL data for MVP so the paid vendor is additive, not blocking.
