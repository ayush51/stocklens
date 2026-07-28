# csv-import

Broker-agnostic CSV upload → column mapping → background reconciliation into `Transaction`/`Holding`. Parsing runs in an Inngest job, not inline on the request — see `docs/phase-0/10-data-flow.md` §1.

Planned layout: `components/` (UploadDropzone, ColumnMapper, ImportPreviewTable), `server/` (parse.ts, reconcile.ts, job-handler.ts), `types.ts`.
