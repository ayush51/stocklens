import { describe, expect, it } from "vitest";
import { resolveTimeframe } from "./timeframe";

describe("resolveTimeframe", () => {
  const now = new Date("2026-07-31T12:00:00Z");

  it("resolves a fixed window relative to now", () => {
    const result = resolveTimeframe(30, now);
    expect(result.asOf).toEqual(now);
    expect(result.windowDays).toBe(30);
    expect(result.since.toISOString()).toBe("2026-07-01T12:00:00.000Z");
  });

  it("resolves a custom range using its own end date as asOf", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-11T00:00:00Z");
    const result = resolveTimeframe({ from, to }, now);
    expect(result.since).toEqual(from);
    expect(result.asOf).toEqual(to);
    expect(result.windowDays).toBe(10);
  });

  it("floors windowDays at 1 for a same-day custom range", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-01T23:59:59Z");
    const result = resolveTimeframe({ from, to }, now);
    expect(result.windowDays).toBe(1);
  });
});
