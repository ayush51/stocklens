# filings

SEC filings list and detail view. Implements `shared/contracts/filings-provider.ts` via `providers/sec-edgar/`. Filing content is untrusted external text — never rendered with `dangerouslySetInnerHTML` on raw upstream markup, never concatenated into an AI prompt as instructions. See `docs/phase-0/09-security-model.md` §5.

Planned layout: `providers/sec-edgar/`, `components/` (FilingsList, FilingViewer), `server/`.
