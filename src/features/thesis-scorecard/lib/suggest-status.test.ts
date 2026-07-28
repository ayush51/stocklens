import { describe, expect, it } from "vitest";

import { suggestCriterionStatus } from "./suggest-status";

describe("suggestCriterionStatus", () => {
  describe("NUMERIC_THRESHOLD", () => {
    const base = {
      ruleType: "NUMERIC_THRESHOLD" as const,
      direction: "HIGHER_IS_BETTER" as const,
      greenThreshold: 20,
      watchThreshold: 10,
      previousValue: null,
    };

    it("is GREEN when the value meets the green threshold", () => {
      expect(suggestCriterionStatus({ ...base, currentValue: 25 })).toBe("GREEN");
      expect(suggestCriterionStatus({ ...base, currentValue: 20 })).toBe("GREEN");
    });

    it("is WATCH when between watch and green", () => {
      expect(suggestCriterionStatus({ ...base, currentValue: 15 })).toBe("WATCH");
    });

    it("is RED when below the watch threshold", () => {
      expect(suggestCriterionStatus({ ...base, currentValue: 5 })).toBe("RED");
    });

    it("flips the comparison for LOWER_IS_BETTER metrics", () => {
      const lowerIsBetter = {
        ...base,
        direction: "LOWER_IS_BETTER" as const,
        greenThreshold: 10,
        watchThreshold: 20,
      };
      expect(suggestCriterionStatus({ ...lowerIsBetter, currentValue: 5 })).toBe("GREEN");
      expect(suggestCriterionStatus({ ...lowerIsBetter, currentValue: 15 })).toBe("WATCH");
      expect(suggestCriterionStatus({ ...lowerIsBetter, currentValue: 25 })).toBe("RED");
    });

    it("is INSUFFICIENT_DATA when the current value is missing", () => {
      expect(suggestCriterionStatus({ ...base, currentValue: null })).toBe("INSUFFICIENT_DATA");
    });

    it("is INSUFFICIENT_DATA when thresholds aren't configured", () => {
      expect(suggestCriterionStatus({ ...base, greenThreshold: null, currentValue: 25 })).toBe(
        "INSUFFICIENT_DATA",
      );
    });
  });

  describe("PERCENT_GROWTH_THRESHOLD / SEQUENTIAL_CHANGE / YEAR_OVER_YEAR_CHANGE", () => {
    for (const ruleType of [
      "PERCENT_GROWTH_THRESHOLD",
      "SEQUENTIAL_CHANGE",
      "YEAR_OVER_YEAR_CHANGE",
    ] as const) {
      it(`${ruleType}: computes growth % and compares against thresholds`, () => {
        const input = {
          ruleType,
          direction: "HIGHER_IS_BETTER" as const,
          greenThreshold: 20,
          watchThreshold: 5,
          previousValue: 100,
        };
        expect(suggestCriterionStatus({ ...input, currentValue: 130 })).toBe("GREEN"); // +30%
        expect(suggestCriterionStatus({ ...input, currentValue: 108 })).toBe("WATCH"); // +8%
        expect(suggestCriterionStatus({ ...input, currentValue: 101 })).toBe("RED"); // +1%
      });
    }

    it("is INSUFFICIENT_DATA when the previous value is zero (division by zero)", () => {
      expect(
        suggestCriterionStatus({
          ruleType: "SEQUENTIAL_CHANGE",
          direction: "HIGHER_IS_BETTER",
          greenThreshold: 20,
          watchThreshold: 5,
          previousValue: 0,
          currentValue: 100,
        }),
      ).toBe("INSUFFICIENT_DATA");
    });
  });

  describe("CONSECUTIVE_DETERIORATION", () => {
    it("is RED after the required number of consecutive declines", () => {
      const result = suggestCriterionStatus({
        ruleType: "CONSECUTIVE_DETERIORATION",
        direction: "HIGHER_IS_BETTER",
        greenThreshold: null,
        watchThreshold: null,
        currentValue: null,
        previousValue: null,
        history: [100, 90, 80], // two consecutive declines
        consecutivePeriodRequirement: 2,
      });
      expect(result).toBe("RED");
    });

    it("is WATCH with only a partial decline streak", () => {
      const result = suggestCriterionStatus({
        ruleType: "CONSECUTIVE_DETERIORATION",
        direction: "HIGHER_IS_BETTER",
        greenThreshold: null,
        watchThreshold: null,
        currentValue: null,
        previousValue: null,
        history: [80, 90, 85], // one decline, one gain
        consecutivePeriodRequirement: 2,
      });
      expect(result).toBe("WATCH");
    });

    it("is GREEN with no decline at all", () => {
      const result = suggestCriterionStatus({
        ruleType: "CONSECUTIVE_DETERIORATION",
        direction: "HIGHER_IS_BETTER",
        greenThreshold: null,
        watchThreshold: null,
        currentValue: null,
        previousValue: null,
        history: [80, 90, 100],
        consecutivePeriodRequirement: 2,
      });
      expect(result).toBe("GREEN");
    });

    it("is INSUFFICIENT_DATA without enough history", () => {
      const result = suggestCriterionStatus({
        ruleType: "CONSECUTIVE_DETERIORATION",
        direction: "HIGHER_IS_BETTER",
        greenThreshold: null,
        watchThreshold: null,
        currentValue: null,
        previousValue: null,
        history: [100],
        consecutivePeriodRequirement: 2,
      });
      expect(result).toBe("INSUFFICIENT_DATA");
    });
  });

  describe("BOOLEAN_EVENT and QUALITATIVE_MANUAL", () => {
    it("always requires manual judgment — never auto-suggests a status", () => {
      for (const ruleType of ["BOOLEAN_EVENT", "QUALITATIVE_MANUAL"] as const) {
        expect(
          suggestCriterionStatus({
            ruleType,
            direction: "HIGHER_IS_BETTER",
            greenThreshold: 100,
            watchThreshold: 50,
            currentValue: 200,
            previousValue: 100,
          }),
        ).toBe("INSUFFICIENT_DATA");
      }
    });
  });
});
