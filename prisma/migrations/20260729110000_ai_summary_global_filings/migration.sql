-- AISummary.workspaceId becomes nullable: SEC_FILING/EARNINGS_EVENT
-- summaries are objectively about a global-reference-data document (like
-- FinancialStatement) and should be generated once and cached for every
-- workspace, not duplicated per tenant. THESIS summaries remain
-- workspace-scoped (workspaceId set). The RLS policy is updated to allow
-- both: a null workspaceId is globally readable, a set one stays
-- tenant-isolated exactly as before.

ALTER TABLE "AISummary" DROP CONSTRAINT "AISummary_workspaceId_fkey";
ALTER TABLE "AISummary" ALTER COLUMN "workspaceId" DROP NOT NULL;
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP POLICY tenant_isolation ON "AISummary";
CREATE POLICY tenant_isolation ON "AISummary"
  USING ("workspaceId" IS NULL OR "workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IS NULL OR "workspaceId" IN (SELECT app_private.current_user_workspace_ids()));
