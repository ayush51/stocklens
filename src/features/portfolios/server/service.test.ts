import { describe, expect, it } from "vitest";

import { computeHoldingAggregate } from "./service";

describe("computeHoldingAggregate", () => {
  it("computes weighted-average cost across multiple buys", () => {
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "10", price: "100" },
      { type: "BUY", quantity: "10", price: "200" },
    ]);

    expect(result.quantity.toString()).toBe("20");
    // (10*100 + 10*200) / 20 = 150
    expect(result.averageCost.toString()).toBe("150");
  });

  it("reduces quantity on a sell without changing average cost", () => {
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "10", price: "100" },
      { type: "SELL", quantity: "4", price: "999" }, // sell price must not affect cost basis
    ]);

    expect(result.quantity.toString()).toBe("6");
    expect(result.averageCost.toString()).toBe("100");
  });

  it("returns zero quantity and zero average cost when fully sold", () => {
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "5", price: "50" },
      { type: "SELL", quantity: "5", price: "60" },
    ]);

    expect(result.quantity.toString()).toBe("0");
    expect(result.averageCost.toString()).toBe("0");
  });

  it("ignores DIVIDEND and SPLIT rows for quantity/cost-basis purposes", () => {
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "10", price: "100" },
      { type: "DIVIDEND", quantity: "0", price: "0" },
      { type: "SPLIT", quantity: "0", price: "0" },
    ]);

    expect(result.quantity.toString()).toBe("10");
    expect(result.averageCost.toString()).toBe("100");
  });

  it("returns zero for an empty transaction history", () => {
    const result = computeHoldingAggregate([]);

    expect(result.quantity.toString()).toBe("0");
    expect(result.averageCost.toString()).toBe("0");
  });

  it("keeps exact decimal precision — no floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 in IEEE-754 floats; Prisma.Decimal must not inherit that.
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "0.1", price: "10" },
      { type: "BUY", quantity: "0.2", price: "10" },
    ]);

    expect(result.quantity.toString()).toBe("0.3");
  });

  it("recomputes average cost correctly after a partial sell followed by another buy", () => {
    const result = computeHoldingAggregate([
      { type: "BUY", quantity: "10", price: "100" }, // cost basis 1000, avg 100
      { type: "SELL", quantity: "5", price: "150" }, // remaining 5 @ avg 100, cost basis 500
      { type: "BUY", quantity: "5", price: "300" }, // +1500 -> cost basis 2000, qty 10
    ]);

    expect(result.quantity.toString()).toBe("10");
    expect(result.averageCost.toString()).toBe("200");
  });
});
