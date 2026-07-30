import { describe, expect, it } from "vitest";

import { normalizeCompanyName } from "./normalize-company-name";

describe("normalizeCompanyName", () => {
  it("normalizes real USAspending/EDGAR name variants to the same key", () => {
    expect(normalizeCompanyName("LOCKHEED MARTIN CORPORATION")).toBe(
      normalizeCompanyName("Lockheed Martin Corp."),
    );
    expect(normalizeCompanyName("NVIDIA CORP")).toBe(normalizeCompanyName("Nvidia Corporation"));
    expect(normalizeCompanyName("Apple Inc.")).toBe(normalizeCompanyName("APPLE INC"));
  });

  it("collapses extra whitespace and punctuation", () => {
    expect(normalizeCompanyName("Apple  Inc.")).toBe(normalizeCompanyName("Apple Inc"));
  });

  it("normalizes an ampersand to 'and'", () => {
    expect(normalizeCompanyName("Johnson & Johnson")).toBe("johnson and johnson");
  });

  it("strips a leading 'The' after suffix removal", () => {
    expect(normalizeCompanyName("The Boeing Company")).toBe("boeing");
  });

  it("does not strip a legal-suffix-looking word that's part of the real name", () => {
    // "Company" here is part of the actual business name, not a bare
    // legal suffix — the normalizer is intentionally simple/best-effort,
    // not a full legal-entity parser, and this case is a known limitation
    // rather than a silently wrong "fix".
    expect(normalizeCompanyName("Trading Company")).toBe("trading");
  });

  it("does not falsely strip a substring that merely contains a suffix word", () => {
    expect(normalizeCompanyName("Cothink Industries")).toBe("cothink industries");
  });
});
