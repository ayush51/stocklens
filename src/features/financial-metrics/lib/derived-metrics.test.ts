import { describe, expect, it } from "vitest";

import { computeDerivedMetrics } from "./derived-metrics";

describe("computeDerivedMetrics", () => {
  it("computes all four metrics from real-shaped data (NVDA Q1 2027-like)", () => {
    const result = computeDerivedMetrics({
      revenue: "81615000000",
      netIncome: "58321000000",
      operatingIncome: "63188000000",
      operatingCashFlow: "62501000000",
      capitalExpenditures: "3600000000",
    });
    expect(result.operatingMarginPct).toBeCloseTo(77.4, 1);
    expect(result.netMarginPct).toBeCloseTo(71.5, 1);
    expect(result.freeCashFlow).toBeCloseTo(58901000000, -3);
    expect(result.fcfMarginPct).toBeCloseTo(72.2, 1);
  });

  it("returns null margins for zero revenue rather than dividing by zero", () => {
    const result = computeDerivedMetrics({
      revenue: "0",
      netIncome: "-100",
      operatingIncome: "-100",
      operatingCashFlow: "-50",
      capitalExpenditures: "10",
    });
    expect(result.operatingMarginPct).toBeNull();
    expect(result.netMarginPct).toBeNull();
    expect(result.fcfMarginPct).toBeNull();
  });

  it("returns null margins for negative revenue", () => {
    const result = computeDerivedMetrics({
      revenue: "-1000",
      netIncome: "100",
      operatingIncome: "100",
      operatingCashFlow: "100",
      capitalExpenditures: "10",
    });
    expect(result.operatingMarginPct).toBeNull();
  });

  it("computes correctly with negative net income (negative earnings edge case)", () => {
    const result = computeDerivedMetrics({
      revenue: "1000",
      netIncome: "-200",
      operatingIncome: "-150",
      operatingCashFlow: "50",
      capitalExpenditures: "20",
    });
    expect(result.netMarginPct).toBeCloseTo(-20, 1);
    expect(result.operatingMarginPct).toBeCloseTo(-15, 1);
    expect(result.freeCashFlow).toBeCloseTo(30, 1);
  });

  it("handles capex reported as either sign the same way", () => {
    const positive = computeDerivedMetrics({
      revenue: "1000",
      netIncome: "100",
      operatingIncome: "100",
      operatingCashFlow: "200",
      capitalExpenditures: "50",
    });
    const negative = computeDerivedMetrics({
      revenue: "1000",
      netIncome: "100",
      operatingIncome: "100",
      operatingCashFlow: "200",
      capitalExpenditures: "-50",
    });
    expect(positive.freeCashFlow).toBe(negative.freeCashFlow);
  });

  it("returns null when a required field is missing", () => {
    const result = computeDerivedMetrics({
      revenue: "1000",
      netIncome: null,
      operatingIncome: null,
      operatingCashFlow: null,
      capitalExpenditures: null,
    });
    expect(result.operatingMarginPct).toBeNull();
    expect(result.netMarginPct).toBeNull();
    expect(result.freeCashFlow).toBeNull();
    expect(result.fcfMarginPct).toBeNull();
  });
});
