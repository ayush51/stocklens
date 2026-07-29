"use server";

import { requireUser } from "@/lib/auth/session";
import {
  getOrGenerateFilingSummary,
  type FilingSummaryResult,
} from "@/features/ai-summaries/server/get-filing-summary";
import {
  getOrGenerateFinancialsSummary,
  type FinancialsSummaryResult,
} from "@/features/ai-summaries/server/get-financials-summary";

/**
 * User-triggered only — never runs automatically. Generation costs real
 * money against a real API key, so nothing summarizes a filing until a
 * signed-in user explicitly asks for it (requireUser() gate; this is
 * global reference data once written, but the action to spend money
 * generating it still requires being signed in).
 */
export async function generateFilingSummary(filingId: string): Promise<FilingSummaryResult | null> {
  await requireUser();
  return getOrGenerateFilingSummary(filingId);
}

/** Same user-triggered-only reasoning as generateFilingSummary. */
export async function generateFinancialsSummary(companyId: string): Promise<FinancialsSummaryResult | null> {
  await requireUser();
  return getOrGenerateFinancialsSummary(companyId);
}
