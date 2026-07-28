import { describe, expect, it } from "vitest";

import { computeThesisTrend } from "./thesis-trend";

describe("computeThesisTrend", () => {
  it("is INSUFFICIENT_DATA when no criteria have a prior evaluation", () => {
    expect(computeThesisTrend([{ previousStatus: null, currentStatus: "GREEN" }])).toBe("INSUFFICIENT_DATA");
  });

  it("is INSUFFICIENT_DATA when every comparable pair involves INSUFFICIENT_DATA", () => {
    expect(computeThesisTrend([{ previousStatus: "INSUFFICIENT_DATA", currentStatus: "GREEN" }])).toBe(
      "INSUFFICIENT_DATA",
    );
    expect(computeThesisTrend([{ previousStatus: "GREEN", currentStatus: "INSUFFICIENT_DATA" }])).toBe(
      "INSUFFICIENT_DATA",
    );
  });

  it("is STRENGTHENING when more criteria improved than worsened", () => {
    expect(
      computeThesisTrend([
        { previousStatus: "WATCH", currentStatus: "GREEN" },
        { previousStatus: "RED", currentStatus: "WATCH" },
        { previousStatus: "GREEN", currentStatus: "GREEN" },
      ]),
    ).toBe("STRENGTHENING");
  });

  it("is WEAKENING when more criteria worsened than improved", () => {
    expect(
      computeThesisTrend([
        { previousStatus: "GREEN", currentStatus: "RED" },
        { previousStatus: "GREEN", currentStatus: "GREEN" },
      ]),
    ).toBe("WEAKENING");
  });

  it("is UNCHANGED when improvements and declines cancel out", () => {
    expect(
      computeThesisTrend([
        { previousStatus: "WATCH", currentStatus: "GREEN" },
        { previousStatus: "GREEN", currentStatus: "WATCH" },
      ]),
    ).toBe("UNCHANGED");
  });

  it("excludes non-comparable criteria rather than treating them as unchanged", () => {
    expect(
      computeThesisTrend([
        { previousStatus: null, currentStatus: "GREEN" }, // excluded — no prior evaluation
        { previousStatus: "GREEN", currentStatus: "RED" }, // one real decline
      ]),
    ).toBe("WEAKENING");
  });
});
