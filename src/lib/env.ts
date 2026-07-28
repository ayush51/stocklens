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
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),

  // Supabase Auth
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
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
