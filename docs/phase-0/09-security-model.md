# Security Model

## 1. Authentication

- Supabase Auth (email/password + OAuth providers) issues sessions. Next.js middleware (`middleware.ts`) refreshes the session cookie on every request using `@supabase/ssr`.
- A `User` row is created in Postgres via a Supabase Auth webhook/trigger on signup — the app never manages passwords, tokens, or MFA itself.
- Server Components/Actions read the session server-side (`auth.getUser()`), never trust a client-supplied user ID for anything authorization-relevant.

## 2. Authorization

Two layers, deliberately redundant:

1. **Application layer (primary, and where business rules live)**: every `server/queries.ts` / `server/actions.ts` function takes the authenticated `userId`, resolves their `workspaceId` membership, and scopes every Prisma query by `workspaceId`. A query that omits the `workspaceId` filter is a code-review-blocking bug, not a style nit.
2. **Database layer (defense-in-depth)**: Postgres Row Level Security is enabled on every tenant-owned table (see [04-database-design.md §5](./04-database-design.md#5-row-level-security-strategy)). Even if application-layer scoping has a bug, RLS is the backstop that prevents cross-workspace data leakage at the database level.

Role model: `WorkspaceRole` (`OWNER`/`EDITOR`/`VIEWER`) exists in the schema from V1, but V1 only ever creates `OWNER` rows (single-user workspaces) — the authorization checks for `EDITOR`/`VIEWER` semantics are designed but not exercised until Phase 3 ships multi-seat workspaces. This is called out explicitly so Phase 3 isn't a security redesign, just turning on checks that were planned for.

## 3. Robinhood integration boundary

This inherits and extends the standing rule established in `ROBINHOOD_MCP_SECURITY_PLAN.md` at the repo root: **read-only, permanently, enforced in code, not just by prompt/agent convention.**

Concretely:

- `shared/contracts/brokerage-sync-provider.ts` defines the interface every broker adapter implements. **The interface itself has no `placeOrder`, `cancelOrder`, or `exercise` method — those verbs do not exist in the type.** A future engineer (or an AI coding agent working in this repo) cannot "accidentally" wire up a write call, because there is nothing to call; adding one would require a deliberate interface change, which is the point at which this design decision would have to be explicitly revisited and re-approved.

  ```ts
  interface BrokerageSyncProvider {
    getAccountSummary(connection: BrokerageConnectionRef): Promise<AccountSummary>;
    listPositions(connection: BrokerageConnectionRef): Promise<PositionSnapshot[]>;
    listTransactions(connection: BrokerageConnectionRef, since?: Date): Promise<TransactionRecord[]>;
    // Intentionally no write methods. See docs/phase-0/09-security-model.md and
    // ROBINHOOD_MCP_SECURITY_PLAN.md before ever adding one.
  }
  ```

- **Credentials are never stored in our database.** `BrokerageConnection.credentialRef` is an opaque reference into a dedicated secret store (Supabase Vault or equivalent KMS-backed store), not a token/password column. The app process fetches the live credential only at sync-job execution time, uses it, and does not persist it in application logs, error reports, or the job payload.
- **Scopes are requested and stored explicitly** (`BrokerageConnection.scopes`, e.g. `["read:positions", "read:transactions"]`) so a connection's declared permissions are visible in the data model and auditable — a connection should never silently have broader access than the UI told the user it would.
- **The sync job runs in an isolated Inngest function** (`features/brokerage-sync/server/*`) that only ever calls `BrokerageSyncProvider` read methods, writes results as `Transaction`/`Holding` rows, and never receives or forwards any user instruction that could be interpreted as a trading command — there is no code path from "user typed something" to "brokerage adapter call" at all; sync is a scheduled/triggered pull, not a conversational action.
- **Disconnecting is always available and destructive-safe**: revoking a `BrokerageConnection` deletes the credential reference from the secret store and marks the connection `DISCONNECTED`; it never deletes the historical `Transaction`/`Holding` data it already synced (that's the user's data, independent of the live connection).
- Any future second broker integration must satisfy the same constraint before it's added: implements the same read-only interface, no exceptions per-broker.

## 4. Secrets management

| Secret | Storage | Access |
|---|---|---|
| Database credentials | Vercel encrypted env vars, separate per environment | Server runtime only |
| Supabase service role key | Vercel encrypted env vars, **never** exposed to any client bundle | Background jobs / trusted server contexts only, never in a Route Handler that also accepts user input without narrow scoping |
| Robinhood session credential | Supabase Vault (or equivalent), referenced by `credentialRef` | Sync job execution only, fetched just-in-time |
| AI provider API key | Vercel encrypted env vars | `ai-summaries` job only |
| Inngest signing key | Vercel encrypted env vars | Webhook signature verification only |

`.env.example` documents every required variable name with a placeholder and a one-line purpose comment; real values never committed, enforced by `.gitignore` + a pre-commit secret scan.

## 5. Input validation & injection prevention

- All external input (Server Action args, Route Handler bodies, CSV file contents) validated with `zod` before use — see [07-api-design.md §4](./07-api-design.md#4-validation).
- Prisma parameterizes all queries; no raw SQL string concatenation anywhere in feature code. Any genuinely necessary raw query (rare, e.g. a complex analytics aggregate) uses Prisma's tagged-template `$queryRaw` (parameterized), never `$queryRawUnsafe` with interpolated user input.
- CSV import: file size cap, row count cap, MIME/extension check, and parsing happens in a sandboxed job (not inline in the request), so a malformed/malicious file can't tie up a web-facing process. Values are parsed into typed fields (numbers, dates) with rejection (not coercion) on ambiguous input — a row that doesn't parse cleanly goes into `CsvImportJob.errorDetail` for the user to fix, it does not get "best-effort" guessed into the ledger.
- Filing content fetched from SEC EDGAR is treated as untrusted external content: rendered as text/sanitized HTML, never `dangerouslySetInnerHTML` with raw upstream markup, and never passed into a prompt in a way that lets filing content override system instructions for the AI summarizer (prompt-injection containment — filing text is data, wrapped and clearly delimited in the summarization prompt, not concatenated as instructions).

## 6. Rate limiting & abuse prevention

See [07-api-design.md §5](./07-api-design.md#5-rate-limiting). Additionally: SEC EDGAR requires a compliant `User-Agent` and respects its own rate limits — the `filings`/`financial-metrics` providers implement backoff and a shared request budget so one workspace's activity can't exhaust the quota for everyone (a noisy-neighbor concern, not just an external-API courtesy).

## 7. Audit logging

`AuditLog` (see [04-database-design.md §2.7](./04-database-design.md#27-cross-cutting)) records security-relevant actions with actor, action, and metadata: brokerage connect/disconnect, workspace membership changes (Phase 3), thesis deletion. It is append-only and not user-editable. This is scoped intentionally — it is not a general activity feed, to avoid it becoming noisy/ignored.

## 8. Data privacy

- Portfolio/holding/transaction data is financial PII by nature — scoped strictly by `workspaceId` per the authorization model above; never aggregated or exposed cross-workspace (no "see what other users hold" feature, ever, without a fundamentally different opt-in product decision).
- AI summary generation sends filing/earnings text (public SEC/market data) to the AI provider — never sends a user's portfolio composition, thesis text, or personal data as part of a filing-summary prompt. A thesis-drift-detection prompt (Phase 3) that does need thesis text is scoped to that specific request only, not logged/retained by the provider beyond what the provider's own data-use terms allow (verified at Phase 3 implementation time, not assumed now).

## 9. Threat model summary

| Threat | Mitigation |
|---|---|
| Cross-tenant data leakage | `workspaceId` scoping at app layer + Postgres RLS as backstop |
| Robinhood credential compromise | Never stored in our DB; opaque reference into a secret store; read-only scopes only |
| Accidental write-capable brokerage call | No write method exists in the `BrokerageSyncProvider` interface — structurally impossible, not just policy |
| CSV upload abuse (large/malicious files) | Size/row caps, sandboxed background parsing, typed validation with rejection over coercion |
| Prompt injection via filing/earnings text into AI summaries | Untrusted content treated as delimited data in prompts, never as instructions |
| Credential/secret leakage via logs or client bundle | Service-role and provider keys server-only; error reporting scrubs known secret env var names |
| Abuse of external API quotas (SEC EDGAR) shared across tenants | Shared backoff/budget in the provider adapter, not per-request-unlimited |
