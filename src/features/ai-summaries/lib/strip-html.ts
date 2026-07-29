/**
 * Reduces a raw SEC filing HTML document to plain text before it's sent to
 * an LLM — filings are often hundreds of KB to a few MB of markup, tables,
 * and inline styles; stripping that out keeps the prompt focused on actual
 * content instead of burning context (and money) on tags. Not a full HTML
 * parser — a filing document is well-formed enough that a few targeted
 * regexes are sufficient and avoid pulling in a DOM-parsing dependency for
 * a single use site.
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|p|div|tr|li|h[1-6])\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
