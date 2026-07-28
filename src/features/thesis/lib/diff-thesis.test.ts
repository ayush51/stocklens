import { describe, expect, it } from "vitest";

import { diffThesisVersions, type DiffableThesis } from "./diff-thesis";

function baseThesis(overrides: Partial<DiffableThesis> = {}): DiffableThesis {
  return {
    title: "Oracle cloud transition",
    summary: "OCI is underpriced relative to growth.",
    whyMispriced: "Market still values Oracle as a legacy license vendor.",
    expectedDrivers: "RPO conversion, OCI capacity ramp.",
    risks: "Capex overruns, hyperscaler competition.",
    keyAssumptions: "RPO growth continues at 40%+.",
    timeHorizon: "18-24 months",
    valuationNotes: "20x forward FCF.",
    positionSizingRationale: "5% of portfolio, room to add.",
    reasonsToAdd: "RPO beats.",
    reasonsToHold: "Thesis intact.",
    reasonsToTrim: "Position exceeds 10%.",
    reasonsToExit: "RPO growth decelerates below 20%.",
    invalidationConditions: "Two consecutive quarters of RPO deceleration.",
    conviction: "MEDIUM",
    targetPrice: "220",
    ...overrides,
  };
}

describe("diffThesisVersions", () => {
  it("reports no changes between identical snapshots", () => {
    const thesis = baseThesis();
    expect(diffThesisVersions(thesis, thesis)).toEqual([]);
  });

  it("reports a single changed text field by its human-readable label", () => {
    const before = baseThesis();
    const after = baseThesis({ risks: "New risk: export controls." });

    expect(diffThesisVersions(before, after)).toEqual(["Risks"]);
  });

  it("reports conviction and target price changes with their own labels", () => {
    const before = baseThesis();
    const after = baseThesis({ conviction: "HIGH", targetPrice: "250" });

    expect(diffThesisVersions(before, after)).toEqual(["Conviction", "Target price"]);
  });

  it("treats null and empty string as equal for optional text fields", () => {
    const before = baseThesis({ whyMispriced: null });
    const after = baseThesis({ whyMispriced: null });

    expect(diffThesisVersions(before, after)).toEqual([]);
  });

  it("reports multiple changed fields in field order", () => {
    const before = baseThesis();
    const after = baseThesis({ summary: "Updated summary.", invalidationConditions: "Updated condition." });

    expect(diffThesisVersions(before, after)).toEqual(["Summary", "Invalidation conditions"]);
  });
});
