import { describe, expect, it } from "vitest";

import { fnv1aHash } from "./hash";

describe("fnv1aHash", () => {
  it("is deterministic — same input always produces the same hash", () => {
    expect(fnv1aHash("2026-01-15|AAPL|BUY|10|150")).toBe(fnv1aHash("2026-01-15|AAPL|BUY|10|150"));
  });

  it("produces different hashes for different input", () => {
    expect(fnv1aHash("2026-01-15|AAPL|BUY|10|150")).not.toBe(fnv1aHash("2026-01-15|AAPL|BUY|10|151"));
  });

  it("is sensitive to field order, not just field content", () => {
    expect(fnv1aHash("A|B")).not.toBe(fnv1aHash("B|A"));
  });

  it("returns a fixed-length hex string", () => {
    expect(fnv1aHash("")).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1aHash("x".repeat(1000))).toMatch(/^[0-9a-f]{8}$/);
  });
});
