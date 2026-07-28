# alerts

User-defined `AlertRule`s (price threshold, new filing, upcoming earnings, thesis-stale) evaluated on a scheduled sweep, delivered as `AlertEvent`s. See `docs/phase-0/10-data-flow.md` §4.

Planned layout: `components/` (AlertRuleForm, AlertList), `server/evaluators/` (one per `AlertType`).
