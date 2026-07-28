/**
 * AI summarization boundary — implemented by features/ai-summaries/providers/claude.
 * Callers pass already-delimited, already-untrusted-marked content; the
 * provider implementation is responsible for keeping that content as data in
 * the prompt, never as instructions. See docs/phase-0/09-security-model.md §5.
 */

export interface AISummaryRequest {
  subjectType: "SEC_FILING" | "EARNINGS_EVENT" | "THESIS";
  /** Untrusted external content (filing text, earnings notes) to summarize. */
  content: string;
  promptVersion: string;
}

export interface AISummaryResult {
  content: string;
  model: string;
  promptVersion: string;
}

export interface AISummaryProvider {
  summarize(request: AISummaryRequest): Promise<AISummaryResult>;
}
