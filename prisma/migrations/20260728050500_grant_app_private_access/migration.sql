-- The rls_and_roles migration created app_private and its helper function
-- but never granted app_user (or service_role_app) access to either — the
-- earlier `GRANT USAGE ON SCHEMA public` only covers `public`. Every policy
-- that calls app_private.current_user_workspace_ids() (i.e. every tenant
-- table except User) was failing with "permission denied for schema
-- app_private" as a result.
GRANT USAGE ON SCHEMA app_private TO app_user, service_role_app;
GRANT EXECUTE ON FUNCTION app_private.current_user_workspace_ids() TO app_user, service_role_app;
