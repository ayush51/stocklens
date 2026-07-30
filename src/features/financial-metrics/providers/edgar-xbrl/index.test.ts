import { afterEach, describe, expect, it, vi } from "vitest";

import { edgarXbrlMetricsProvider } from "./index";

function usdEntries(
  entries: Array<{
    start?: string;
    end: string;
    val: number;
    fy: number;
    fp: string;
    form?: string;
    filed: string;
  }>,
) {
  return { units: { USD: entries.map((e) => ({ form: "10-Q", ...e })) } };
}

function mockCompanyFacts(usGaap: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ entityName: "Test Co", facts: { "us-gaap": usGaap } }),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("edgarXbrlMetricsProvider.getFinancialStatements", () => {
  it("falls through to a later candidate tag for periods the earlier tag never covers (real NVDA capex tag migration)", async () => {
    // Verified live against real NVDA data: PaymentsToAcquirePropertyPlantAndEquipment
    // has real entries, but only through fiscal 2020; PaymentsToAcquireProductiveAssets
    // is what NVDA actually reports capex under from 2021 onward. A naive
    // "first candidate with any data wins" would lock onto the old tag and
    // never look at the new one, leaving all recent periods null.
    mockCompanyFacts({
      PaymentsToAcquirePropertyPlantAndEquipment: usdEntries([
        { start: "2019-11-01", end: "2020-01-31", val: 111, fy: 2020, fp: "Q4", filed: "2020-03-01" },
      ]),
      PaymentsToAcquireProductiveAssets: usdEntries([
        { start: "2025-11-01", end: "2026-01-31", val: 999, fy: 2026, fp: "Q4", filed: "2026-03-01" },
      ]),
    });

    const statements = await edgarXbrlMetricsProvider.getFinancialStatements("0000000000");
    const fy2026Q4 = statements.find((s) => s.fiscalYear === 2026 && s.fiscalPeriod === "Q4");
    const fy2020Q4 = statements.find((s) => s.fiscalYear === 2020 && s.fiscalPeriod === "Q4");

    expect(fy2026Q4?.capitalExpenditures).toBe("999");
    expect(fy2020Q4?.capitalExpenditures).toBe("111");
  });

  it("accepts a year-to-date cumulative entry for cash-flow fields when no discrete quarter entry exists", async () => {
    mockCompanyFacts({
      NetCashProvidedByUsedInOperatingActivities: usdEntries([
        // Q2 reported as YTD cumulative (start = fiscal-year start, not quarter start) — real SEC pattern.
        { start: "2025-02-01", end: "2025-07-31", val: 5000, fy: 2026, fp: "Q2", filed: "2025-09-01" },
      ]),
    });

    const statements = await edgarXbrlMetricsProvider.getFinancialStatements("0000000000");
    const q2 = statements.find((s) => s.fiscalYear === 2026 && s.fiscalPeriod === "Q2");
    expect(q2?.operatingCashFlow).toBe("5000");
  });

  it("does not accept a year-to-date cumulative entry for income-statement fields (strict quarter-only)", async () => {
    mockCompanyFacts({
      Revenues: usdEntries([
        { start: "2025-02-01", end: "2025-07-31", val: 5000, fy: 2026, fp: "Q2", filed: "2025-09-01" },
      ]),
    });

    const statements = await edgarXbrlMetricsProvider.getFinancialStatements("0000000000");
    const q2 = statements.find((s) => s.fiscalYear === 2026 && s.fiscalPeriod === "Q2");
    expect(q2?.revenue ?? null).toBeNull();
  });

  it("prefers a discrete-quarter value over a cumulative one for the same period, regardless of fetch order", async () => {
    mockCompanyFacts({
      NetCashProvidedByUsedInOperatingActivities: usdEntries([
        { start: "2025-02-01", end: "2025-07-31", val: 5000, fy: 2026, fp: "Q2", filed: "2025-09-01" }, // cumulative
        { start: "2025-05-01", end: "2025-07-31", val: 2500, fy: 2026, fp: "Q2", filed: "2025-09-01" }, // discrete
      ]),
    });

    const statements = await edgarXbrlMetricsProvider.getFinancialStatements("0000000000");
    const q2 = statements.find((s) => s.fiscalYear === 2026 && s.fiscalPeriod === "Q2");
    expect(q2?.operatingCashFlow).toBe("2500");
  });
});
