import { describe, expect, it } from "vitest";

import { parseAmountRange, estimateRangeMidpoint } from "./parse-amount-range";

describe("parseAmountRange", () => {
  it("parses the real standard STOCK Act disclosure buckets", () => {
    expect(parseAmountRange("$1,001 - $15,000")).toEqual({ min: 1001, max: 15000 });
    expect(parseAmountRange("$15,001 - $50,000")).toEqual({ min: 15001, max: 50000 });
    expect(parseAmountRange("$50,001 - $100,000")).toEqual({ min: 50001, max: 100000 });
    expect(parseAmountRange("$1,000,001 - $5,000,000")).toEqual({ min: 1000001, max: 5000000 });
  });

  it("parses an en-dash separated range", () => {
    expect(parseAmountRange("$1,001–$15,000")).toEqual({ min: 1001, max: 15000 });
  });

  it("parses an open-ended 'Over $X' range with a null upper bound", () => {
    expect(parseAmountRange("Over $50,000,000")).toEqual({ min: 50000000, max: null });
  });

  it("parses a single exact figure as both bounds", () => {
    expect(parseAmountRange("$5,000")).toEqual({ min: 5000, max: 5000 });
  });

  it("returns null bounds for unrecognized text rather than guessing", () => {
    expect(parseAmountRange("Undisclosed")).toEqual({ min: null, max: null });
    expect(parseAmountRange("")).toEqual({ min: null, max: null });
  });
});

describe("estimateRangeMidpoint", () => {
  it("computes the arithmetic midpoint of a real bucket", () => {
    expect(estimateRangeMidpoint({ min: 1001, max: 15000 })).toBe(8000.5);
  });

  it("returns null for an open-ended range (no meaningful midpoint)", () => {
    expect(estimateRangeMidpoint({ min: 50000000, max: null })).toBeNull();
  });

  it("returns null when both bounds are missing", () => {
    expect(estimateRangeMidpoint({ min: null, max: null })).toBeNull();
  });
});
