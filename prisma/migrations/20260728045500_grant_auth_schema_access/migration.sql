-- app_user is a custom role we created, not one of Supabase's built-in
-- anon/authenticated/service_role roles — those get USAGE on the `auth`
-- schema and EXECUTE on auth.uid()/auth.role() automatically as part of
-- Supabase's own project provisioning. A custom role gets neither by
-- default, which made every RLS policy that calls auth.uid() fail with
-- "permission denied for schema auth" (surfaced by Postgres as a generic
-- RLS violation on the affected table).
GRANT USAGE ON SCHEMA auth TO app_user;
GRANT EXECUTE ON FUNCTION auth.uid() TO app_user;
