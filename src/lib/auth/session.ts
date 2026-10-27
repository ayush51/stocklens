import { cache } from "react";

import { AppError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

/**
 * Returns the current authenticated user, or null. Use in places where an
 * unauthenticated visitor is a valid state (e.g. marketing pages).
 *
 * Wrapped in React's cache() so the layout and the page it renders share one
 * Supabase Auth round trip per request instead of each paying for their own.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

/**
 * Returns the current authenticated user, or throws UNAUTHORIZED. Use at the
 * top of every authenticated Server Action / query — never trust a
 * client-supplied user id, always resolve it server-side from the session.
 * See docs/phase-0/09-security-model.md §2.
 */
export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError("UNAUTHORIZED", "You must be signed in to do that.");
  }

  return user;
}
