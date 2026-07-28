-- The ALTER DEFAULT PRIVILEGES statement in the previous migration only
-- covers tables created AFTER it ran — every table already existed at that
-- point (from the init migration), so service_role_app needs an explicit
-- grant on them too.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role_app;
