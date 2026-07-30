import { describe, expect, it } from "vitest";

import { computeEvidenceScore, type ScoreInput } from "./scoring";

const ASOF = new Date("2026-07-30T00:00:00Z");

function emptyInput(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return { insiderEvents: [], contractEvents: [], congressEvents: [], asOf: ASOF, ...overrides };
}

describe("computeEvidenceScore", () => {
  it("returns an all-zero score with no explanations when there are no qualifying events", () => {
    const result = computeEvidenceScore(emptyInput());
    expect(result.totalScore).toBe(0);
    expect(result.components).toEqual({
      insider: 0,
      governmentContracts: 0,
      congress: 0,
      convergenceBonus: 0,
    });
    expect(result.categoriesMatched).toBe(0);
    expect(result.explanations).toEqual([]);
  });

  it("gives no positive insider score for routine compensation activity (grants, gifts, exercises, tax withholding)", () => {
    const result = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "OFFICER",
            classification: "AWARD_OR_GRANT",
            transactionDate: "2026-07-28",
            estimatedTotalValue: null,
          },
          {
            reportingPersonName: "B",
            relationshipCategory: "DIRECTOR",
            classification: "GIFT",
            transactionDate: "2026-07-28",
            estimatedTotalValue: null,
          },
          {
            reportingPersonName: "C",
            relationshipCategory: "OFFICER",
            classification: "OPTION_EXERCISE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: null,
          },
          {
            reportingPersonName: "D",
            relationshipCategory: "OFFICER",
            classification: "TAX_WITHHOLDING",
            transactionDate: "2026-07-28",
            estimatedTotalValue: null,
          },
          {
            reportingPersonName: "E",
            relationshipCategory: "OFFICER",
            classification: "AUTOMATIC_OR_PLANNED",
            transactionDate: "2026-07-28",
            estimatedTotalValue: null,
          },
        ],
      }),
    );
    expect(result.components.insider).toBe(0);
  });

  it("scores higher for multiple independent open-market purchases than a single isolated one", () => {
    const single = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    const multiple = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
          {
            reportingPersonName: "B",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
          {
            reportingPersonName: "C",
            relationshipCategory: "OFFICER",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    expect(multiple.components.insider).toBeGreaterThan(single.components.insider);
    expect(multiple.components.insider).toBeLessThanOrEqual(35);
  });

  it("gives an officer purchase a higher score than a non-officer purchase, all else equal", () => {
    const officer = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "OFFICER",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    const director = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    expect(officer.components.insider).toBeGreaterThan(director.components.insider);
  });

  it("applies recency decay — an old purchase scores lower than a recent one, all else equal", () => {
    const recent = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    const old = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "DIRECTOR",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-01-01",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    expect(recent.components.insider).toBeGreaterThan(old.components.insider);
  });

  it("never awards contract points for a de-obligation or a $0 correction", () => {
    const result = computeEvidenceScore(
      emptyInput({
        contractEvents: [
          {
            recordType: "DE_OBLIGATION",
            actionDate: "2026-07-28",
            newlyObligatedAmount: -5_000_000,
            resolutionConfidence: 1,
          },
          {
            recordType: "CORRECTION",
            actionDate: "2026-07-28",
            newlyObligatedAmount: 0,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    expect(result.components.governmentContracts).toBe(0);
  });

  it("scores a larger new-award obligation higher than a smaller one", () => {
    const small = computeEvidenceScore(
      emptyInput({
        contractEvents: [
          {
            recordType: "NEW_AWARD",
            actionDate: "2026-07-28",
            newlyObligatedAmount: 500_000,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    const large = computeEvidenceScore(
      emptyInput({
        contractEvents: [
          {
            recordType: "NEW_AWARD",
            actionDate: "2026-07-28",
            newlyObligatedAmount: 150_000_000,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    expect(large.components.governmentContracts).toBeGreaterThan(small.components.governmentContracts);
    expect(large.components.governmentContracts).toBeLessThanOrEqual(30);
  });

  it("applies a data-quality penalty for a low-confidence company mapping", () => {
    const confident = computeEvidenceScore(
      emptyInput({
        contractEvents: [
          {
            recordType: "NEW_AWARD",
            actionDate: "2026-07-28",
            newlyObligatedAmount: 150_000_000,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    const lowConfidence = computeEvidenceScore(
      emptyInput({
        contractEvents: [
          {
            recordType: "NEW_AWARD",
            actionDate: "2026-07-28",
            newlyObligatedAmount: 150_000_000,
            resolutionConfidence: 0.5,
          },
        ],
      }),
    );
    expect(lowConfidence.components.governmentContracts).toBeLessThan(
      confident.components.governmentContracts,
    );
  });

  it("only counts congressional purchases, not sales, toward the score", () => {
    const result = computeEvidenceScore(
      emptyInput({
        congressEvents: [
          {
            politicianName: "Rep A",
            transactionType: "SALE",
            transactionDate: "2026-07-28",
            disclosureDelayDays: 20,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    expect(result.components.congress).toBe(0);
  });

  it("applies a penalty for a very late disclosure beyond the 45-day STOCK Act window", () => {
    const timely = computeEvidenceScore(
      emptyInput({
        congressEvents: [
          {
            politicianName: "Rep A",
            transactionType: "PURCHASE",
            transactionDate: "2026-07-28",
            disclosureDelayDays: 20,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    const late = computeEvidenceScore(
      emptyInput({
        congressEvents: [
          {
            politicianName: "Rep A",
            transactionType: "PURCHASE",
            transactionDate: "2026-07-28",
            disclosureDelayDays: 120,
            resolutionConfidence: 1,
          },
        ],
      }),
    );
    expect(late.components.congress).toBeLessThan(timely.components.congress);
  });

  it("awards no convergence bonus with only one qualifying category", () => {
    const result = computeEvidenceScore(
      emptyInput({
        insiderEvents: [
          {
            reportingPersonName: "A",
            relationshipCategory: "OFFICER",
            classification: "OPEN_MARKET_PURCHASE",
            transactionDate: "2026-07-28",
            estimatedTotalValue: 50000,
          },
        ],
      }),
    );
    expect(result.categoriesMatched).toBe(1);
    expect(result.components.convergenceBonus).toBe(0);
  });

  it("matches the spec's own worked example shape: three categories, real convergence bonus, full explanation set", () => {
    const result = computeEvidenceScore({
      asOf: ASOF,
      insiderEvents: [
        {
          reportingPersonName: "CEO A",
          relationshipCategory: "OFFICER",
          classification: "OPEN_MARKET_PURCHASE",
          transactionDate: "2026-07-25",
          estimatedTotalValue: 500_000,
        },
        {
          reportingPersonName: "CFO B",
          relationshipCategory: "OFFICER",
          classification: "OPEN_MARKET_PURCHASE",
          transactionDate: "2026-07-20",
          estimatedTotalValue: 300_000,
        },
      ],
      contractEvents: [
        {
          recordType: "NEW_AWARD",
          actionDate: "2026-07-22",
          newlyObligatedAmount: 45_000_000,
          resolutionConfidence: 1,
        },
      ],
      congressEvents: [
        {
          politicianName: "Rep A",
          transactionType: "PURCHASE",
          transactionDate: "2026-07-18",
          disclosureDelayDays: 25,
          resolutionConfidence: 0.9,
        },
      ],
    });

    expect(result.categoriesMatched).toBe(3);
    expect(result.components.insider).toBeGreaterThan(0);
    expect(result.components.governmentContracts).toBeGreaterThan(0);
    expect(result.components.congress).toBeGreaterThan(0);
    expect(result.components.convergenceBonus).toBeGreaterThan(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
    expect(result.explanations.length).toBeGreaterThanOrEqual(4); // 3 category explanations + the convergence note
    expect(result.explanations.some((e) => e.includes("3 of 3"))).toBe(true);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it("never exceeds a total score of 100 even with maximal inputs across all categories", () => {
    const manyInsiders = Array.from({ length: 5 }, (_, i) => ({
      reportingPersonName: `Person ${i}`,
      relationshipCategory: "OFFICER" as const,
      classification: "OPEN_MARKET_PURCHASE" as const,
      transactionDate: "2026-07-29",
      estimatedTotalValue: 10_000_000,
    }));
    const result = computeEvidenceScore({
      asOf: ASOF,
      insiderEvents: manyInsiders,
      contractEvents: Array.from({ length: 5 }, () => ({
        recordType: "NEW_AWARD" as const,
        actionDate: "2026-07-29",
        newlyObligatedAmount: 500_000_000,
        resolutionConfidence: 1,
      })),
      congressEvents: Array.from({ length: 5 }, (_, i) => ({
        politicianName: `Rep ${i}`,
        transactionType: "PURCHASE" as const,
        transactionDate: "2026-07-29",
        disclosureDelayDays: 10,
        resolutionConfidence: 1,
      })),
    });
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });
});
