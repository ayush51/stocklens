import { describe, expect, it } from "vitest";
import {
  bucketSamples,
  computeForwardReturnPct,
  findClosestBarOnOrBefore,
  MIN_SAMPLE_SIZE_FOR_AVERAGE,
} from "./evaluation";

describe("findClosestBarOnOrBefore", () => {
  const bars = [
    { date: "2026-01-02", close: "100" },
    { date: "2026-01-05", close: "105" },
    { date: "2026-01-09", close: "110" },
  ];

  it("picks the most recent bar on or before the target date", () => {
    expect(findClosestBarOnOrBefore(bars, "2026-01-06")?.close).toBe("105");
  });

  it("returns an exact match when the target date has a bar", () => {
    expect(findClosestBarOnOrBefore(bars, "2026-01-05")?.close).toBe("105");
  });

  it("returns null when every bar is after the target date", () => {
    expect(findClosestBarOnOrBefore(bars, "2026-01-01")).toBeNull();
  });

  it("returns null for an empty bar list rather than guessing", () => {
    expect(findClosestBarOnOrBefore([], "2026-01-05")).toBeNull();
  });
});

describe("computeForwardReturnPct", () => {
  it("computes a positive return", () => {
    expect(computeForwardReturnPct(100, 110)).toBeCloseTo(10);
  });

  it("computes a negative return", () => {
    expect(computeForwardReturnPct(100, 90)).toBeCloseTo(-10);
  });
});

describe("bucketSamples", () => {
  it("only reports an average once the minimum sample size is met", () => {
    const samples = Array.from({ length: MIN_SAMPLE_SIZE_FOR_AVERAGE - 1 }, () => ({
      totalScore: 70,
      forwardReturnPct: 5,
    }));
    const buckets = bucketSamples(samples);
    const highBucket = buckets.find((b) => b.label === "60-100")!;
    expect(highBucket.evaluableCount).toBe(MIN_SAMPLE_SIZE_FOR_AVERAGE - 1);
    expect(highBucket.averageForwardReturnPct).toBeNull();
  });

  it("reports a real average once enough evaluable samples exist", () => {
    const samples = [
      { totalScore: 65, forwardReturnPct: 10 },
      { totalScore: 70, forwardReturnPct: 20 },
      { totalScore: 80, forwardReturnPct: 30 },
    ];
    const buckets = bucketSamples(samples);
    const highBucket = buckets.find((b) => b.label === "60-100")!;
    expect(highBucket.averageForwardReturnPct).toBeCloseTo(20);
  });

  it("excludes non-evaluable (null-return) samples from the average but still counts them", () => {
    const samples = [
      { totalScore: 65, forwardReturnPct: 10 },
      { totalScore: 70, forwardReturnPct: 20 },
      { totalScore: 80, forwardReturnPct: 30 },
      { totalScore: 75, forwardReturnPct: null },
    ];
    const buckets = bucketSamples(samples);
    const highBucket = buckets.find((b) => b.label === "60-100")!;
    expect(highBucket.sampleCount).toBe(4);
    expect(highBucket.evaluableCount).toBe(3);
    expect(highBucket.averageForwardReturnPct).toBeCloseTo(20);
  });

  it("sorts samples into the correct score bucket boundaries", () => {
    const samples = [
      { totalScore: 0, forwardReturnPct: 1 },
      { totalScore: 29, forwardReturnPct: 1 },
      { totalScore: 30, forwardReturnPct: 1 },
      { totalScore: 59, forwardReturnPct: 1 },
      { totalScore: 60, forwardReturnPct: 1 },
      { totalScore: 100, forwardReturnPct: 1 },
    ];
    const buckets = bucketSamples(samples);
    expect(buckets.find((b) => b.label === "0-29")!.sampleCount).toBe(2);
    expect(buckets.find((b) => b.label === "30-59")!.sampleCount).toBe(2);
    expect(buckets.find((b) => b.label === "60-100")!.sampleCount).toBe(2);
  });
});
