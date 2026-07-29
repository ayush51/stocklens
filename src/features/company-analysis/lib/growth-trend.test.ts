import { describe, expect, it } from "vitest";

import { computeGrowthTrend, computeMarginTrend, type StatementForTrend } from "./growth-trend";

function stmt(
  fiscalYear: number,
  fiscalPeriod: string,
  revenue: number | null,
  grossProfit: number | null = null,
): StatementForTrend {
  return { fiscalYear, fiscalPeriod, revenue, grossProfit, fetchedAt: new Date("2026-07-29") };
}

describe("computeGrowthTrend", () => {
  it("detects accelerating growth from real-shaped data (NVDA-like: YoY growth rate rising each quarter)", () => {
    const statements = [
      stmt(2025, "Q2", 30040),
      stmt(2025, "Q3", 35082),
      stmt(2026, "Q2", 46743), // YoY vs Q2'25: +55.6%
      stmt(2026, "Q3", 57006), // YoY vs Q3'25: +62.5%
    ];
    const result = computeGrowthTrend(statements);
    expect(result.state).toBe("ACCELERATING");
    expect(result.dataPoints).toHaveLength(2);
  });

  it("detects decelerating growth when the YoY rate drops meaningfully", () => {
    const statements = [
      stmt(2025, "Q1", 100),
      stmt(2025, "Q2", 100),
      stmt(2026, "Q1", 200), // +100% YoY
      stmt(2026, "Q2", 120), // +20% YoY
    ];
    const result = computeGrowthTrend(statements);
    expect(result.state).toBe("DECELERATING");
  });

  it("reads two similar YoY rates as stable, not noise", () => {
    const statements = [
      stmt(2025, "Q1", 100),
      stmt(2025, "Q2", 100),
      stmt(2026, "Q1", 110), // +10%
      stmt(2026, "Q2", 111), // +11%
    ];
    const result = computeGrowthTrend(statements);
    expect(result.state).toBe("STABLE");
  });

  it("returns INSUFFICIENT_DATA with fewer than two YoY-comparable quarters", () => {
    const result = computeGrowthTrend([stmt(2026, "Q1", 100)]);
    expect(result.state).toBe("INSUFFICIENT_DATA");
    expect(result.dataPoints).toHaveLength(0);
  });

  it("skips a quarter with no same-quarter prior-year match (missing quarter) rather than crashing", () => {
    const statements = [
      stmt(2025, "Q1", 100),
      stmt(2026, "Q1", 110),
      stmt(2026, "Q3", 999), // no 2025 Q3 counterpart in this fixture
    ];
    const result = computeGrowthTrend(statements);
    expect(result.dataPoints.map((d) => d.period)).toEqual(["Q1 2026"]);
    expect(result.state).toBe("INSUFFICIENT_DATA");
  });

  it("skips a comparison when the prior-year base is zero or negative rather than dividing by it", () => {
    const statements = [
      stmt(2025, "Q1", 0),
      stmt(2026, "Q1", 100),
      stmt(2025, "Q2", -50),
      stmt(2026, "Q2", 100),
    ];
    const result = computeGrowthTrend(statements);
    expect(result.dataPoints).toHaveLength(0);
    expect(result.state).toBe("INSUFFICIENT_DATA");
  });

  it("excludes FY (annual) rows from the quarterly YoY comparison", () => {
    const statements = [
      stmt(2025, "FY", 1000),
      stmt(2026, "FY", 1500),
      stmt(2025, "Q1", 100),
      stmt(2026, "Q1", 110),
    ];
    const result = computeGrowthTrend(statements);
    expect(result.dataPoints).toHaveLength(1); // only the Q1 pair, not FY
  });

  it("handles null revenue for a quarter without crashing", () => {
    const statements = [stmt(2025, "Q1", 100), stmt(2026, "Q1", null)];
    const result = computeGrowthTrend(statements);
    expect(result.dataPoints).toHaveLength(0);
  });
});

describe("computeMarginTrend", () => {
  it("detects improving margin", () => {
    const statements = [
      stmt(2025, "Q1", 100, 40), // 40% margin
      stmt(2025, "Q2", 100, 40),
      stmt(2026, "Q1", 100, 42), // 42% margin, +2pp
      stmt(2026, "Q2", 100, 48), // 48% margin, +8pp
    ];
    const result = computeMarginTrend(statements);
    expect(result.state).toBe("IMPROVING");
  });

  it("detects declining margin", () => {
    const statements = [
      stmt(2025, "Q1", 100, 40),
      stmt(2025, "Q2", 100, 40),
      stmt(2026, "Q1", 100, 40), // flat, 0pp
      stmt(2026, "Q2", 100, 30), // -10pp
    ];
    const result = computeMarginTrend(statements);
    expect(result.state).toBe("DECLINING");
  });

  it("handles zero revenue without dividing by zero", () => {
    const statements = [stmt(2025, "Q1", 0, 0), stmt(2026, "Q1", 100, 40)];
    const result = computeMarginTrend(statements);
    expect(result.dataPoints).toHaveLength(0);
    expect(result.state).toBe("INSUFFICIENT_DATA");
  });

  it("handles a second, unrelated company's real-shaped data (ORCL-like: stable low-growth margin)", () => {
    const statements = [
      stmt(2025, "Q1", 12000, 9000), // 75%
      stmt(2025, "Q2", 12200, 9100),
      stmt(2026, "Q1", 12300, 9250), // 75.2%
      stmt(2026, "Q2", 12500, 9400), // 75.2%
    ];
    const result = computeMarginTrend(statements);
    expect(result.state).toBe("STABLE");
  });
});
