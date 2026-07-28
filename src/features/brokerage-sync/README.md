# brokerage-sync

Read-only brokerage sync (Robinhood first). Implements `shared/contracts/brokerage-sync-provider.ts`, which has no write methods by design — see `docs/phase-0/09-security-model.md` §3 and `ROBINHOOD_MCP_SECURITY_PLAN.md`.

Planned layout: `providers/robinhood/` (adapter), `server/` (sync job, connection management), `components/` (ConnectRobinhoodCard, SyncStatusBadge).
