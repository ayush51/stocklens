import { AppError } from "@/lib/errors";
import type { AISummaryProvider } from "@/shared/contracts/ai-summary-provider";

/**
 * Fail-closed default when no GEMINI_API_KEY is configured. Unlike the
 * market-data unavailable provider (which resolves to "no data" so pages
 * degrade quietly), summarization has no silent-degradation state that
 * makes sense — there's no partial summary. This throws a clear,
 * actionable error instead, which the UI turns into "AI summaries aren't
 * configured yet" rather than a raw 500.
 */
export const unavailableAISummaryProvider: AISummaryProvider = {
  async summarize() {
    throw new AppError(
      "UPSTREAM_UNAVAILABLE",
      "AI summaries aren't configured yet — GEMINI_API_KEY is not set.",
    );
  },
};
