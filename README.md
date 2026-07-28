# StockLens

A plug-and-play investment research and thesis-tracking dashboard for any publicly traded company. See [`docs/phase-0/`](./docs/phase-0/README.md) for the full design package (PRD, architecture, database design, security model, implementation plan).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (Supabase) · Vercel

## Getting started

```bash
npm install
cp .env.example .env       # fill in Supabase/Prisma values — see .env.example for what each is for
npx prisma generate
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

Feature-based architecture — see [`docs/phase-0/03-folder-structure.md`](./docs/phase-0/03-folder-structure.md) for the full rationale. Short version:

- `src/app/` — routing and page composition only, no business logic
- `src/features/*/` — one directory per domain capability (portfolios, thesis, filings, alerts, …), each owning its own components/server logic/types
- `src/shared/` — cross-feature components, hooks, and provider interfaces (`contracts/`)
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/` — cross-cutting infra: Prisma client, auth session helpers, env validation, logging, error types

## Security

The Robinhood brokerage integration is **read-only, permanently, enforced at the type level** (no write method exists on the sync provider interface) — see [`docs/phase-0/09-security-model.md`](./docs/phase-0/09-security-model.md) and [`ROBINHOOD_MCP_SECURITY_PLAN.md`](./ROBINHOOD_MCP_SECURITY_PLAN.md).
