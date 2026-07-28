"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export interface AuthActionState {
  error: string | null;
  /** Set when sign-up succeeded but requires email confirmation before a session exists. */
  checkEmail?: boolean;
}

/**
 * Derives the current request's origin from headers rather than a hardcoded
 * env var, so email confirmation links resolve correctly whether the
 * request came from production, a Vercel preview deployment, or local dev —
 * without needing a separate NEXT_PUBLIC_SITE_URL per environment.
 *
 * Still requires the target URL to be in Supabase's Redirect URLs allow-list
 * (dashboard: Authentication > URL Configuration) — Supabase validates
 * emailRedirectTo against that list regardless of what the app sends, as a
 * guard against open-redirect abuse. That allow-list is dashboard-only
 * config, not something this app can set from code.
 */
async function currentOrigin() {
  const headersList = await headers();
  return headersList.get("origin") ?? `https://${headersList.get("host")}`;
}

export async function signInWithPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  redirect("/dashboard");
}

export async function signUpWithPassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await currentOrigin()}/auth/callback` },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation enabled (Supabase's default), signUp() returns
  // no session — there's nothing to redirect into yet. Only auto-confirmed
  // signups (confirmation disabled in the dashboard) get a session here.
  if (!data.session) {
    return { error: null, checkEmail: true };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
