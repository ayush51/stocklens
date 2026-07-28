import { type NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

/**
 * Exchanges an OAuth/email-link `code` for a session. Supabase Auth redirects
 * here after the user completes sign-in with a third-party provider or
 * clicks a magic-link/confirmation email.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}
