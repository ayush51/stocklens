-- Postgres requires a newly INSERTed row to satisfy the table's own SELECT
-- policy before it can be returned via RETURNING (which Prisma's .create()
-- always requests). A brand-new Workspace has no WorkspaceMember row yet at
-- the moment it's inserted, so workspace_select can never pass for it in the
-- same statement — a genuine chicken-and-egg case, not a grants problem.
--
-- Fix: one narrowly-scoped SECURITY DEFINER function that creates the
-- Workspace + WorkspaceMember pair atomically, bypassing RLS for exactly
-- this one bootstrap operation. It enforces internally that a caller can
-- only ever bootstrap a workspace for themselves (p_user_id must equal
-- auth.uid()) — SECURITY DEFINER elevates privilege, so that check has to
-- live inside the function, not rely on the caller's own RLS context.
CREATE OR REPLACE FUNCTION app_private.bootstrap_workspace(
  p_workspace_id UUID,
  p_workspace_name TEXT,
  p_member_id UUID,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'bootstrap_workspace: p_user_id must match the calling user';
  END IF;

  INSERT INTO "Workspace" (id, name) VALUES (p_workspace_id, p_workspace_name);
  INSERT INTO "WorkspaceMember" (id, "workspaceId", "userId", role)
    VALUES (p_member_id, p_workspace_id, p_user_id, 'OWNER');
END;
$$;

-- Minimal grant: EXECUTE on this one function only. No CREATE on the
-- app_private schema, no blanket EXECUTE on every function in it — app_user
-- gets exactly the one privileged operation it needs and nothing else.
GRANT EXECUTE ON FUNCTION app_private.bootstrap_workspace(UUID, TEXT, UUID, UUID) TO app_user;
