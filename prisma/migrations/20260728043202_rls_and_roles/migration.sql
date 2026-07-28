-- Row Level Security + least-privilege roles.
-- Rationale: docs/phase-0/09-security-model.md §2-3, docs/phase-0/04-database-design.md §5.
--
-- Two new roles, in addition to the migration-owning `postgres` role:
--   - app_user:         RLS-constrained. Used by the request-scoped Prisma
--                        client for all user-triggered reads/writes. Full
--                        CRUD grant on tenant tables (gated by policy below),
--                        SELECT-only on global reference tables.
--   - service_role_app: BYPASSRLS. Used by background jobs and trusted
--                        system code (seed scripts, filing/price ingestion)
--                        that isn't acting on behalf of one specific user's
--                        request. Full CRUD on everything, no policies apply.
--
-- Passwords are set to a placeholder here and rotated immediately after this
-- migration applies via a separate, untracked `ALTER ROLE` command — real
-- credentials never belong in a committed migration file.
--
-- auth.uid() only resolves correctly when something sets the
-- `request.jwt.claims` session variable first (normally done by Supabase's
-- PostgREST layer). Since this app connects via Prisma directly, that's done
-- per-request by src/lib/db/rls.ts's Prisma Client extension.
--
-- NOTE for future migrations: newly added TENANT tables need an explicit
-- GRANT + tenant_isolation-style policy for app_user (there's no default-
-- privileges shortcut here, because whether a new table should be
-- SELECT-only-global or full-CRUD-tenant is a deliberate per-table decision).
-- service_role_app gets new tables automatically via ALTER DEFAULT PRIVILEGES
-- below, since it should always have full access.

-- ─────────────────────────────────────────────────────────────
-- Roles
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user LOGIN PASSWORD 'placeholder-rotated-immediately-after-migration';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role_app') THEN
    CREATE ROLE service_role_app LOGIN PASSWORD 'placeholder-rotated-immediately-after-migration' BYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO app_user, service_role_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role_app;

-- ─────────────────────────────────────────────────────────────
-- Helper: current user's workspace ids, via a SECURITY DEFINER function so
-- policies that reference "WorkspaceMember" from within its own policy don't
-- recursively re-apply that same policy to the lookup itself.
-- See: https://supabase.com/docs/guides/database/postgres/row-level-security#helper-functions
-- ─────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS app_private;

CREATE OR REPLACE FUNCTION app_private.current_user_workspace_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT "workspaceId" FROM "WorkspaceMember" WHERE "userId" = auth.uid();
$$;

-- ─────────────────────────────────────────────────────────────
-- Grants — tenant tables (full CRUD for app_user, gated by RLS below)
-- ─────────────────────────────────────────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON
  "User", "Workspace", "WorkspaceMember", "Portfolio", "Holding", "Transaction",
  "BrokerageConnection", "CsvImportJob", "Thesis", "ThesisRevision", "EarningsReview",
  "AlertRule", "AlertEvent", "AISummary", "AuditLog"
TO app_user;

-- Grants — global reference tables (read-only for app_user; writes are
-- service_role_app / background-job only)
GRANT SELECT ON "Company", "PriceSnapshot", "FinancialStatement", "SecFiling", "EarningsEvent" TO app_user;

-- ─────────────────────────────────────────────────────────────
-- Enable RLS on every table
-- ─────────────────────────────────────────────────────────────
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Workspace" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkspaceMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Portfolio" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Holding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BrokerageConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CsvImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Thesis" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ThesisRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EarningsReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AlertEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AISummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Company" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PriceSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FinancialStatement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecFiling" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EarningsEvent" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- Policies — identity
-- ─────────────────────────────────────────────────────────────
CREATE POLICY user_self ON "User"
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Policies — Workspace / WorkspaceMember
-- INSERT is split out from the rest: a brand-new user has no existing
-- WorkspaceMember row yet, so the membership-based check can't gate their
-- very first workspace/membership creation without a chicken-and-egg
-- deadlock. Workspace creation is open to any authenticated request;
-- WorkspaceMember creation is restricted to inserting a row for yourself.
-- ─────────────────────────────────────────────────────────────
CREATE POLICY workspace_select ON "Workspace"
  FOR SELECT USING (id IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_update ON "Workspace"
  FOR UPDATE USING (id IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_delete ON "Workspace"
  FOR DELETE USING (id IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_insert ON "Workspace"
  FOR INSERT WITH CHECK (true);

CREATE POLICY workspace_member_select ON "WorkspaceMember"
  FOR SELECT USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_member_update ON "WorkspaceMember"
  FOR UPDATE USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_member_delete ON "WorkspaceMember"
  FOR DELETE USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));
CREATE POLICY workspace_member_insert ON "WorkspaceMember"
  FOR INSERT WITH CHECK ("userId" = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Policies — tenant tables with a direct workspaceId column
-- ─────────────────────────────────────────────────────────────
CREATE POLICY tenant_isolation ON "Portfolio"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

CREATE POLICY tenant_isolation ON "Thesis"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

CREATE POLICY tenant_isolation ON "EarningsReview"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

CREATE POLICY tenant_isolation ON "AlertRule"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

CREATE POLICY tenant_isolation ON "AISummary"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

CREATE POLICY tenant_isolation ON "AuditLog"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));

-- ─────────────────────────────────────────────────────────────
-- Policies — tenant tables scoped via a parent table's workspaceId
-- ─────────────────────────────────────────────────────────────
CREATE POLICY tenant_isolation ON "Holding"
  USING (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"));

CREATE POLICY tenant_isolation ON "Transaction"
  USING (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"));

CREATE POLICY tenant_isolation ON "BrokerageConnection"
  USING (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"));

CREATE POLICY tenant_isolation ON "CsvImportJob"
  USING (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Portfolio" p WHERE p.id = "portfolioId"));

CREATE POLICY tenant_isolation ON "ThesisRevision"
  USING (EXISTS (SELECT 1 FROM "Thesis" t WHERE t.id = "thesisId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Thesis" t WHERE t.id = "thesisId"));

CREATE POLICY tenant_isolation ON "AlertEvent"
  USING (EXISTS (SELECT 1 FROM "AlertRule" r WHERE r.id = "alertRuleId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "AlertRule" r WHERE r.id = "alertRuleId"));

-- Note: these EXISTS subqueries deliberately rely on the parent table's own
-- tenant_isolation policy (Portfolio/Thesis/AlertRule) to do the actual
-- workspace filtering — the parent row is only visible to app_user if it's
-- already in the caller's workspace, so "exists a matching parent row" is
-- sufficient. No SECURITY DEFINER needed here (no self-reference, no
-- recursion risk).

-- ─────────────────────────────────────────────────────────────
-- Policies — global reference tables (open read, no write policy: writes
-- are blocked at the GRANT level for app_user, and service_role_app
-- bypasses RLS entirely)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY public_read ON "Company" FOR SELECT USING (true);
CREATE POLICY public_read ON "PriceSnapshot" FOR SELECT USING (true);
CREATE POLICY public_read ON "FinancialStatement" FOR SELECT USING (true);
CREATE POLICY public_read ON "SecFiling" FOR SELECT USING (true);
CREATE POLICY public_read ON "EarningsEvent" FOR SELECT USING (true);
