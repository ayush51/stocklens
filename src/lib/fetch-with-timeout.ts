/**
 * instructions.md §6 "apply timeouts to external calls" — every raw
 * fetch() to an external provider in this app previously had none, which
 * means a single hung upstream request could hold a Vercel function open
 * indefinitely instead of failing with a clear, fast error.
 *
 * Thin wrapper, not a new abstraction layer: same signature as fetch,
 * just adds an AbortController tied to a deadline. Provider code still
 * owns its own retry/fallback/error-shape logic on top of this.
 */
export async function fetchWithTimeout(
  input: string | URL,
  init: RequestInit = {},
  timeoutMs = 10_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
