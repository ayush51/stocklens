# earnings

Earnings calendar per company and structured `EarningsReview` notes. A review can spawn a `ThesisRevision` (trigger `EARNINGS_REVIEW`) — see `docs/phase-0/10-data-flow.md` §5.

`getUpcomingEarningsForUser` fetches live from Finnhub and, as a side effect, persists each entry into `EarningsEvent` (`server/persist.ts`) — the only way to later compare actual vs. estimate, since Finnhub's free tier never returns past dates once a report's date has passed. `getPastEarningsForUser` reads those persisted events back, joined against real `FinancialStatement` actuals, and classifies each as a real beat/miss/inline (`lib/surprise.ts`). Review history only builds up going forward from when this shipped — nothing is backfilled for reports that passed before their estimate was ever captured.
