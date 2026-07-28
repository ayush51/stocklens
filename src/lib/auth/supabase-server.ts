import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * Server-side Supabase client (Server Components, Server Actions, Route
 * Handlers). Reads/writes the session cookie via next/headers — this is the
 * only supported way to keep the session in sync across SSR requests.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component (not a Server Action/Route Handler) —
          // middleware already refreshes the session, so this is safe to ignore.
        }
      },
    },
  });
}
