import { createBrowserClient } from "@supabase/ssr";

import { clientEnv } from "@/lib/env.client";

/**
 * Client-side Supabase client, for the small set of Client Components that
 * need it directly (e.g. the sign-in form). Most of the app never imports
 * this — reads/writes go through Server Components/Actions instead, see
 * docs/phase-0/08-component-architecture.md §3.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(clientEnv.NEXT_PUBLIC_SUPABASE_URL, clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
