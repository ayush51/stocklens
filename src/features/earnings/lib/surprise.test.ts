import { describe, expect, it } from "vitest";

import { computeEarningsSurprise } from "./surprise";

describe("computeEarningsSurprise", () => {
  it("classifies a real beat (NVDA-shaped: est 0.75, actual 0.81)", () => {
    const result = computeEarningsSurprise("0.75", "0.81");
    expect(result.classification).toBe("BEAT");
    expect(result.surprisePct).toBeCloseTo(8, 0);
  });

  it("classifies a real miss", () => {
    const result = computeEarningsSurprise("1.00", "0.90");
    expect(result.classification).toBe("MISS");
    expect(result.surprisePct).toBeCloseTo(-10, 0);
  });

  it("classifies a near-exact match as inline, not a beat", () => {
    const result = computeEarningsSurprise("1.00", "1.01");
    expect(result.classification).toBe("INLINE");
  });

  it("handles a negative estimate (loss expected) correctly via abs() denominator", () => {
    // Losing less than expected is a beat, not a miss — abs() on the
    // denominator is what makes this work instead of flipping the sign.
    const result = computeEarningsSurprise("-1.00", "-0.50");
    expect(result.classification).toBe("BEAT");
    expect(result.surprisePct).toBeCloseTo(50, 0);
  });

  it("returns NOT_YET_REPORTED when no actual exists yet, not a fabricated miss", () => {
    const result = computeEarningsSurprise("0.75", null);
    expect(result.classification).toBe("NOT_YET_REPORTED");
    expect(result.surprisePct).toBeNull();
  });

  it("returns NO_ESTIMATE when there was never a consensus estimate", () => {
    const result = computeEarningsSurprise(null, "0.81");
    expect(result.classification).toBe("NO_ESTIMATE");
    expect(result.surprisePct).toBeNull();
  });

  it("returns NO_ESTIMATE rather than dividing by zero", () => {
    const result = computeEarningsSurprise("0", "0.10");
    expect(result.classification).toBe("NO_ESTIMATE");
    expect(result.surprisePct).toBeNull();
  });
});
