import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // The installed @prisma/config (7.9.1) has no `directUrl` field — only
    // `url`/`shadowDatabaseUrl`. CLI commands (migrate/introspect/studio) need
    // a direct, non-pooled connection since pgbouncer's transaction pooling
    // mode doesn't support the migration engine's prepared statements. The
    // running app uses the pooled connection instead, via its own adapter in
    // src/lib/db/prisma.ts (env.DATABASE_URL) — this url is CLI-only.
    url: env("DIRECT_URL"),
  },
});
