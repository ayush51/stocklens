import { describe, expect, it } from "vitest";

import { computeValuationPosition } from "./valuation-position";

describe("computeValuationPosition", () => {
  it("reads a price near the 52-week low as the lower half", () => {
    const result = computeValuationPosition("110", "200", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("LOWER_HALF");
    expect(result.percentileWithinRange).toBeCloseTo(10, 1);
  });

  it("reads a price near the 52-week high as the upper half", () => {
    const result = computeValuationPosition("190", "200", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("UPPER_HALF");
    expect(result.percentileWithinRange).toBeCloseTo(90, 1);
  });

  it("flags a price that has since moved above its recorded 52-week high", () => {
    const result = computeValuationPosition("250", "200", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("ABOVE_RANGE");
  });

  it("flags a price that has since moved below its recorded 52-week low", () => {
    const result = computeValuationPosition("50", "200", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("BELOW_RANGE");
  });

  it("returns INSUFFICIENT_DATA when any input is missing", () => {
    const result = computeValuationPosition(null, "200", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("INSUFFICIENT_DATA");
    expect(result.percentileWithinRange).toBeNull();
  });

  it("returns INSUFFICIENT_DATA when the range is degenerate (high <= low)", () => {
    const result = computeValuationPosition("150", "100", "100", "2026-07-29T00:00:00Z");
    expect(result.state).toBe("INSUFFICIENT_DATA");
  });
});
