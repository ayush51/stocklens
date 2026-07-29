/**
 * Models sometimes wrap JSON in markdown code fences despite being told
 * not to — stripped defensively before parsing rather than trusting the
 * instruction was followed exactly. Shared by every schema in this feature
 * that parses a provider's raw JSON-string output.
 */
export function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}
