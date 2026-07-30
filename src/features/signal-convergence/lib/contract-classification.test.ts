import { describe, expect, it } from "vitest";

import { classifyContractAction } from "./contract-classification";

describe("classifyContractAction", () => {
  it("classifies the base award action as NEW_AWARD (real Lockheed example: action date matches base obligation date, no mod number)", () => {
    const result = classifyContractAction({
      modificationNumber: null,
      actionDate: "2025-08-20",
      baseObligationDate: "2025-08-20",
      federalActionObligation: 2128265,
    });
    expect(result).toBe("NEW_AWARD");
  });

  it("classifies a real funds-adding modification as MODIFICATION (real example: P00063, +$24.6M)", () => {
    const result = classifyContractAction({
      modificationNumber: "P00063",
      actionDate: "2026-02-13",
      baseObligationDate: "2025-08-20",
      federalActionObligation: 24619976.13,
    });
    expect(result).toBe("MODIFICATION");
  });

  it("classifies a $0 administrative action as CORRECTION, not a modification (real example: 'updated MVRS on attachment 1')", () => {
    const result = classifyContractAction({
      modificationNumber: "A00030",
      actionDate: "2026-04-03",
      baseObligationDate: "2025-08-20",
      federalActionObligation: 0,
    });
    expect(result).toBe("CORRECTION");
  });

  it("classifies a negative obligation as DE_OBLIGATION, never as a positive signal", () => {
    const result = classifyContractAction({
      modificationNumber: "P00099",
      actionDate: "2026-05-01",
      baseObligationDate: "2025-08-20",
      federalActionObligation: -500000,
    });
    expect(result).toBe("DE_OBLIGATION");
  });

  it("treats modificationNumber '0' the same as null for base-action detection", () => {
    const result = classifyContractAction({
      modificationNumber: "0",
      actionDate: "2025-08-20",
      baseObligationDate: "2025-08-20",
      federalActionObligation: 100,
    });
    expect(result).toBe("NEW_AWARD");
  });

  it("does not classify as NEW_AWARD when the action date differs from the base obligation date, even with no mod number", () => {
    const result = classifyContractAction({
      modificationNumber: null,
      actionDate: "2026-01-15",
      baseObligationDate: "2025-08-20",
      federalActionObligation: 1000,
    });
    expect(result).toBe("MODIFICATION");
  });
});
