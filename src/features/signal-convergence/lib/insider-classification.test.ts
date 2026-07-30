import { describe, expect, it } from "vitest";

import {
  classifyInsiderTransaction,
  resolveIsPurchase,
  resolveRelationshipCategory,
} from "./insider-classification";

describe("classifyInsiderTransaction", () => {
  it("classifies an unplanned open-market purchase (code P)", () => {
    expect(classifyInsiderTransaction("P", false)).toBe("OPEN_MARKET_PURCHASE");
  });

  it("classifies an unplanned open-market sale (code S)", () => {
    expect(classifyInsiderTransaction("S", false)).toBe("OPEN_MARKET_SALE");
  });

  it("classifies a 10b5-1 planned purchase as AUTOMATIC_OR_PLANNED, not a fresh open-market purchase", () => {
    expect(classifyInsiderTransaction("P", true)).toBe("AUTOMATIC_OR_PLANNED");
  });

  it("classifies a 10b5-1 planned sale as AUTOMATIC_OR_PLANNED", () => {
    expect(classifyInsiderTransaction("S", true)).toBe("AUTOMATIC_OR_PLANNED");
  });

  it.each(["M", "C", "O", "X"])("classifies derivative exercise code %s as OPTION_EXERCISE", (code) => {
    expect(classifyInsiderTransaction(code, false)).toBe("OPTION_EXERCISE");
  });

  it("classifies code A as AWARD_OR_GRANT", () => {
    expect(classifyInsiderTransaction("A", false)).toBe("AWARD_OR_GRANT");
  });

  it("classifies code G as GIFT (real NVDA filing example verified live)", () => {
    expect(classifyInsiderTransaction("G", false)).toBe("GIFT");
  });

  it("classifies code F as TAX_WITHHOLDING", () => {
    expect(classifyInsiderTransaction("F", false)).toBe("TAX_WITHHOLDING");
  });

  it("classifies an unrecognized/other code as OTHER rather than guessing", () => {
    expect(classifyInsiderTransaction("Z", false)).toBe("OTHER");
  });

  it("is case-insensitive on the raw code", () => {
    expect(classifyInsiderTransaction("p", false)).toBe("OPEN_MARKET_PURCHASE");
  });
});

describe("resolveIsPurchase", () => {
  it("treats acquired (A) as a purchase", () => {
    expect(resolveIsPurchase("A")).toBe(true);
  });

  it("treats disposed (D) as a sale", () => {
    expect(resolveIsPurchase("D")).toBe(false);
  });

  it("returns null for an unrecognized code rather than guessing a direction", () => {
    expect(resolveIsPurchase(null)).toBeNull();
    expect(resolveIsPurchase("")).toBeNull();
  });
});

describe("resolveRelationshipCategory", () => {
  it("prioritizes officer over director when both are set", () => {
    expect(
      resolveRelationshipCategory({
        isDirector: true,
        isOfficer: true,
        isTenPercentOwner: false,
        isOther: false,
      }),
    ).toBe("OFFICER");
  });

  it("falls back to director when officer is not set", () => {
    expect(
      resolveRelationshipCategory({
        isDirector: true,
        isOfficer: false,
        isTenPercentOwner: false,
        isOther: false,
      }),
    ).toBe("DIRECTOR");
  });

  it("falls back to ten-percent owner when neither officer nor director is set", () => {
    expect(
      resolveRelationshipCategory({
        isDirector: false,
        isOfficer: false,
        isTenPercentOwner: true,
        isOther: false,
      }),
    ).toBe("TEN_PERCENT_OWNER");
  });

  it("falls back to OTHER when no flags are set", () => {
    expect(
      resolveRelationshipCategory({
        isDirector: false,
        isOfficer: false,
        isTenPercentOwner: false,
        isOther: true,
      }),
    ).toBe("OTHER");
  });
});
