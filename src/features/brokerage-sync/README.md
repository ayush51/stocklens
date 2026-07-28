# brokerage-sync

Provider-agnostic brokerage connector boundary. Implements `shared/contracts/brokerage-connector.ts`, whose `capabilities.trading` field is typed as the literal `false` and which has no write methods at all — see `docs/phase-0/09-security-model.md` §3 and `ROBINHOOD_MCP_SECURITY_PLAN.md`.

`server/get-connector.ts` is the single entry point for reaching a connector — never import a concrete provider module directly.

- `providers/robinhood-mcp/` — wraps the MCP-assisted ingest (`server/ingest.ts`). Positions-only; can't "fetch" live (the MCP tools only exist inside a Claude chat session), so `connect()` is where new data enters and `syncPositions()` just reads it back out of Supabase.
- `providers/manual/` — degenerate connector (no external system); the real manual-entry write path is direct Portfolio/Transaction forms, not this interface.
- `providers/unimplemented/` — stub for `CSV_IMPORT` (until its real parser lands), `SNAPTRADE`, and `PLAID`. Every method throws rather than silently no-op-ing.
