import { env } from "@/lib/env";
import type { AISummaryProvider } from "@/shared/contracts/ai-summary-provider";
import { createGeminiAISummaryProvider } from "@/features/ai-summaries/providers/gemini";
import { unavailableAISummaryProvider } from "@/features/ai-summaries/providers/unavailable";

/** Single entry point for reaching an AI summary provider — never import a concrete provider directly. */
export function getAISummaryProvider(): AISummaryProvider {
  if (!env.GEMINI_API_KEY) {
    return unavailableAISummaryProvider;
  }
  return createGeminiAISummaryProvider(env.GEMINI_API_KEY);
}
