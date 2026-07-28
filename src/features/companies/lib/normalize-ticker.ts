/**
 * Client-safe. Kept separate from server/queries.ts so Client Components
 * (e.g. the search box) can import it without pulling in the server-only
 * Prisma client that queries.ts depends on.
 */
export function normalizeTicker(raw: string): string {
  return raw.trim().toUpperCase();
}
