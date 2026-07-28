import { z } from "zod";

/**
 * Every environment variable the app reads goes through this schema.
 * Fail fast at startup rather than surfacing `undefined` deep in a feature —
 * see docs/phase-0/09-security-model.md §4.
 *
 * SERVER-ONLY. Never import this from a "use client" component — it
 * validates secrets (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY) that don't
 * exist in the browser bundle and would throw at import time. Client
 * Components that need a public var use @/lib/env.client instead.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Prisma / Postgres (Supabase)
  // DATABASE_URL connects as `app_user` (RLS-constrained) — the default
  // client, used for request-scoped queries via src/lib/db/rls.ts#forUser.
  DATABASE_URL: z.string().url(),
  // DIRECT_URL connects as the `postgres` owner role — Prisma CLI only
  // (migrate/introspect/studio), never imported by app runtime code.
  DIRECT_URL: z.string().url(),
  // SERVICE_DATABASE_URL connects as `service_role_app` (BYPASSRLS) — used
  // only by trusted system code (background jobs, seed scripts) that isn't
  // acting on behalf of one specific user's request. See
  // docs/phase-0/04-database-design.md §5 and the rls_and_roles migration.
  SERVICE_DATABASE_URL: z.string().url(),

  // Supabase Auth
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Brokerage sync (see docs/phase-0/09-security-model.md §3)
  // Base64-encoded 32-byte key for AES-256-GCM envelope encryption of
  // brokerage credentials (EncryptedSecret table). Generate with:
  // `openssl rand -base64 32`. Never reused for anything else.
  CREDENTIAL_ENCRYPTION_KEY: z
    .string()
    .refine((value) => {
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    }, "must be a base64-encoded 32-byte key (openssl rand -base64 32)"),
  // Global kill switch — checked before every brokerage sync attempt.
  // "false" disables all sync activity across every workspace immediately,
  // no deploy required. Defaults to enabled.
  BROKERAGE_SYNC_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

// Validated once per process; every module imports this instead of touching
// process.env directly, so a missing/malformed var fails at startup.
export const env = loadEnv();
