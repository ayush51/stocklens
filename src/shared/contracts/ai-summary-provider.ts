/**
 * AI summarization boundary — implemented by features/ai-summaries/providers/claude.
 * Callers pass already-delimited, already-untrusted-marked content; the
 * provider implementation is responsible for keeping that content as data in
 * the prompt, never as instructions. See docs/phase-0/09-security-model.md §5.
 */

export interface AISummaryRequest {
  subjectType: "SEC_FILING" | "EARNINGS_EVENT" | "THESIS" | "COMPANY_FINANCIALS";
  /** Untrusted external content (filing text, earnings notes) to summarize. */
  content: string;
  promptVersion: string;
}

export interface AISummaryResult {
  content: string;
  model: string;
  promptVersion: string;
}

export interface MetricToExtract {
  key: string;
  label: string;
  description: string | null;
  unit: string;
}

export interface KpiExtractionRequest {
  /** Untrusted filing text to read the metrics from. */
  content: string;
  metrics: MetricToExtract[];
  promptVersion: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  /** Real, DB-sourced grounding data (portfolio holdings, thesis status) — trusted, not user-supplied free text. */
  context: string;
  promptVersion: string;
}

export interface ThesisDraftRequest {
  ticker: string;
  companyName: string;
  /** Real, DB/provider-sourced financial data (statements, ratios, cached summary) — not user-authored. */
  content: string;
  promptVersion: string;
}

export interface NewsImpactRequest {
  ticker: string;
  companyName: string;
  /** Untrusted third-party content — headline/summary only, never scraped full article text. */
  headline: string;
  summary: string;
  /** The user's own thesis summary for this company, if one exists — real, workspace-specific context. */
  thesisContext: string | null;
  promptVersion: string;
}

export interface TemplateProposalRequest {
  ticker: string;
  companyName: string;
  sector: string | null;
  industry: string | null;
  promptVersion: string;
}

export interface AISummaryProvider {
  summarize(request: AISummaryRequest): Promise<AISummaryResult>;
  /**
   * Reads actual reported values for a fixed list of named metrics out of
   * filing text — a different task from summarize(): structured, cited
   * extraction rather than free narrative. Same untrusted-content handling
   * rules apply. result.content is a JSON string encoding
   * KpiExtractionContent — see ai-summaries/lib/kpi-extraction-schema.ts.
   */
  extractMetrics(request: KpiExtractionRequest): Promise<AISummaryResult>;
  /**
   * Multi-turn conversational Q&A grounded in the user's real portfolio
   * data. result.content is plain conversational text, not JSON — there's
   * no fixed structured shape to validate here, unlike summarize/
   * extractMetrics.
   */
  chat(request: ChatRequest): Promise<AISummaryResult>;
  /**
   * Drafts a starting-point investment thesis from real financial data —
   * never a finished thesis, never auto-saved (see thesis/server/
   * generate-draft.ts and instructions.md §8: "Do not silently generate a
   * thesis and represent it as user-authored"). result.content is a JSON
   * string encoding ThesisDraftContent — see
   * thesis/lib/thesis-draft-schema.ts.
   */
  draftThesis(request: ThesisDraftRequest): Promise<AISummaryResult>;
  /**
   * Classifies one news item's likely relevance from its headline/summary
   * alone (see news/README and docs/phase-0/09-security-model.md §5 —
   * full article text is never fetched/scraped). result.content is a JSON
   * string encoding NewsImpactContent — see
   * news/lib/news-impact-schema.ts.
   */
  classifyNewsImpact(request: NewsImpactRequest): Promise<AISummaryResult>;
  /**
   * Proposes which company-specific KPIs are typically worth tracking for
   * a company, based on general knowledge of the company/industry — NOT
   * grounded in a specific filing (see company-metrics'
   * MetricTemplateSource.AI_PROPOSED and its existing UI disclosure).
   * result.content is a JSON string encoding TemplateProposalContent —
   * see company-metrics/lib/template-proposal-schema.ts.
   */
  proposeMetricTemplate(request: TemplateProposalRequest): Promise<AISummaryResult>;
}
