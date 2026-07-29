import { describe, expect, it } from "vitest";

import { parseFilingSummaryContent } from "./filing-summary-schema";

const VALID = {
  plainEnglishSummary: "Revenue grew 20% year over year.",
  keyFacts: ["Revenue was $10B, up 20% YoY"],
  notableItems: ["Guidance raised for next quarter"],
  risksOrConcerns: ["Customer concentration risk noted in risk factors"],
  uncertainty: null,
};

describe("parseFilingSummaryContent", () => {
  it("parses valid JSON matching the schema", () => {
    expect(parseFilingSummaryContent(JSON.stringify(VALID))).toEqual(VALID);
  });

  it("strips markdown code fences before parsing", () => {
    const fenced = "```json\n" + JSON.stringify(VALID) + "\n```";
    expect(parseFilingSummaryContent(fenced)).toEqual(VALID);
  });

  it("returns null for invalid JSON rather than throwing", () => {
    expect(parseFilingSummaryContent("not json at all")).toBeNull();
  });

  it("returns null when the JSON doesn't match the expected shape", () => {
    expect(parseFilingSummaryContent(JSON.stringify({ foo: "bar" }))).toBeNull();
  });

  it("returns null when a required field is the wrong type", () => {
    const bad = { ...VALID, keyFacts: "not an array" };
    expect(parseFilingSummaryContent(JSON.stringify(bad))).toBeNull();
  });

  it("accepts a non-null uncertainty string", () => {
    const withUncertainty = { ...VALID, uncertainty: "The filing doesn't clarify the exact date." };
    expect(parseFilingSummaryContent(JSON.stringify(withUncertainty))).toEqual(withUncertainty);
  });
});
