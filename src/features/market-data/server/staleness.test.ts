import { describe, expect, it } from "vitest";

import { DEFAULT_STALENESS_THRESHOLD_MS, isQuoteStale } from "./staleness";

describe("isQuoteStale", () => {
  const now = new Date("2026-07-27T12:00:00.000Z");

  it("is not stale immediately after the market timestamp", () => {
    expect(isQuoteStale({ marketTimestamp: "2026-07-27T12:00:00.000Z" }, now)).toBe(false);
  });

  it("is not stale just under the threshold", () => {
    const justUnder = new Date(now.getTime() - (DEFAULT_STALENESS_THRESHOLD_MS - 1000)).toISOString();
    expect(isQuoteStale({ marketTimestamp: justUnder }, now)).toBe(false);
  });

  it("is stale just over the threshold", () => {
    const justOver = new Date(now.getTime() - (DEFAULT_STALENESS_THRESHOLD_MS + 1000)).toISOString();
    expect(isQuoteStale({ marketTimestamp: justOver }, now)).toBe(true);
  });

  it("respects a custom threshold", () => {
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
    expect(isQuoteStale({ marketTimestamp: fiveMinutesAgo }, now, 60 * 1000)).toBe(true);
    expect(isQuoteStale({ marketTimestamp: fiveMinutesAgo }, now, 10 * 60 * 1000)).toBe(false);
  });
});
