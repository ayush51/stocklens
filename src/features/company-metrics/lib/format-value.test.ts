import { describe, expect, it } from "vitest";

import { formatMetricValue } from "./format-value";

describe("formatMetricValue", () => {
  it("formats USD values with a dollar sign and thousands separators", () => {
    expect(formatMetricValue("12500000000", "USD")).toBe("$12,500,000,000");
  });

  it("formats PERCENT values with a trailing percent sign", () => {
    expect(formatMetricValue("23.5", "PERCENT")).toBe("23.5%");
  });

  it("returns TEXT values unchanged", () => {
    expect(formatMetricValue("Capacity constrained through H2", "TEXT")).toBe(
      "Capacity constrained through H2",
    );
  });

  it("falls back to the raw value when a USD value isn't actually numeric", () => {
    expect(formatMetricValue("not a number", "USD")).toBe("not a number");
  });
});
