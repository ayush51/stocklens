# ai-summaries

Filing/earnings/thesis summarization. Implements `shared/contracts/ai-summary-provider.ts` via `providers/claude/`. Runs only in background jobs, never inline in a request cycle. Cached by content hash (`AISummary.inputHash`) — see `docs/phase-0/10-data-flow.md` §3.

Planned layout: `providers/claude/`, `components/` (SummaryCard, RegenerateButton), `server/`.
