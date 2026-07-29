/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once.
 * Exists because unbounded Promise.all against a rate-limited external API
 * (verified live: Finnhub's free tier 429s under ~30+ simultaneous requests
 * against /calendar/earnings) silently drops results for whichever calls
 * happen to lose the race — see earnings/server/queries.ts.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
