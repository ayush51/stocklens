import { z } from "zod";

/**
 * Public env vars only — safe to import from "use client" components.
 * Never add a server-only secret here; use @/lib/env instead, which is
 * server-only and must never be imported from client code (it validates
 * DATABASE_URL / SUPABASE_SERVICE_ROLE_KEY, which don't exist in the browser
 * bundle and would throw at import time).
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

function loadClientEnv() {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid public environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const clientEnv = loadClientEnv();
