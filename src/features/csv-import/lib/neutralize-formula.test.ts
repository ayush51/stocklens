import { describe, expect, it } from "vitest";

import { neutralizeFormulaInjection } from "./neutralize-formula";

describe("neutralizeFormulaInjection", () => {
  it("neutralizes a leading equals sign (the classic Excel formula trigger)", () => {
    expect(neutralizeFormulaInjection("=1+1")).toBe("'=1+1");
    expect(neutralizeFormulaInjection("=cmd|' /c calc'!A0")).toBe("'=cmd|' /c calc'!A0");
  });

  it("neutralizes a leading plus, at-sign, tab, and carriage return", () => {
    expect(neutralizeFormulaInjection("+1+1")).toBe("'+1+1");
    expect(neutralizeFormulaInjection("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
    expect(neutralizeFormulaInjection("\tHYPERLINK(...)")).toBe("'\tHYPERLINK(...)");
  });

  it("neutralizes a minus-led formula-injection payload, not just a bare negative number", () => {
    expect(neutralizeFormulaInjection("-2+3+cmd|' /c calc'!A0")).toBe("'-2+3+cmd|' /c calc'!A0");
  });

  it("does NOT neutralize a bare negative number — that's ordinary financial data", () => {
    expect(neutralizeFormulaInjection("-500")).toBe("-500");
    expect(neutralizeFormulaInjection("-12.50")).toBe("-12.50");
  });

  it("leaves ordinary values untouched", () => {
    expect(neutralizeFormulaInjection("AAPL")).toBe("AAPL");
    expect(neutralizeFormulaInjection("2026-01-15")).toBe("2026-01-15");
    expect(neutralizeFormulaInjection("Buy")).toBe("Buy");
  });

  it("handles an empty string", () => {
    expect(neutralizeFormulaInjection("")).toBe("");
  });
});
