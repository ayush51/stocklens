import { describe, expect, it } from "vitest";

import {
  computePortfolioScenario,
  computePositionScenarioAtPrice,
  computePositionScenarioAtShock,
} from "./position-scenario";

describe("computePositionScenarioAtPrice", () => {
  it("computes market value and gain/loss at a given price", () => {
    const result = computePositionScenarioAtPrice(
      { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 150 },
      120,
    );

    expect(result.positionMarketValue).toBe(1200);
    expect(result.gainLoss).toBe(200); // (120-100)*10
    expect(result.gainLossPct).toBe(20); // 200/1000 cost basis
  });

  it("computes distance from cost basis as a signed percentage", () => {
    const result = computePositionScenarioAtPrice(
      { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 150 },
      80,
    );
    expect(result.distanceFromCostBasisPct).toBe(-20); // 20% below cost basis
  });

  it("handles a loss scenario correctly", () => {
    const result = computePositionScenarioAtPrice(
      { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 150 },
      50,
    );
    expect(result.gainLoss).toBe(-500);
    expect(result.gainLossPct).toBe(-50);
  });
});

describe("computePositionScenarioAtShock", () => {
  it("applies a percentage shock to the current price, not the cost basis", () => {
    const result = computePositionScenarioAtShock(
      { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 200 },
      -50,
    );
    expect(result.scenarioPrice).toBe(100); // 200 * 0.5
  });

  it("a 0% shock reproduces the current price exactly", () => {
    const result = computePositionScenarioAtShock(
      { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 173.42 },
      0,
    );
    expect(result.scenarioPrice).toBe(173.42);
  });
});

describe("computePortfolioScenario", () => {
  const positions = [
    { ticker: "AAPL", quantity: 10, averageCost: 100, currentPrice: 200 }, // baseline 2000
    { ticker: "MSFT", quantity: 5, averageCost: 300, currentPrice: 400 }, // baseline 2000
  ];

  it("applies the shock only to the selected tickers (single-stock shock)", () => {
    const result = computePortfolioScenario({
      positions,
      shockedTickers: new Set(["AAPL"]),
      shockPct: -50,
    });

    const aapl = result.positions.find((p) => p.ticker === "AAPL")!;
    const msft = result.positions.find((p) => p.ticker === "MSFT")!;

    expect(aapl.wasShocked).toBe(true);
    expect(aapl.scenarioPrice).toBe(100);
    expect(msft.wasShocked).toBe(false);
    expect(msft.scenarioPrice).toBe(400); // unchanged
  });

  it("computes baseline, scenario, and portfolio impact correctly", () => {
    const result = computePortfolioScenario({
      positions,
      shockedTickers: new Set(["AAPL"]),
      shockPct: -50,
    });

    expect(result.baselineMarketValue).toBe(4000); // 2000 + 2000
    expect(result.scenarioMarketValue).toBe(3000); // 1000 (AAPL halved) + 2000 (MSFT unchanged)
    expect(result.portfolioImpact).toBe(-1000);
    expect(result.portfolioImpactPct).toBe(-25);
  });

  it("applies a broad-market shock to every position when all tickers are shocked", () => {
    const result = computePortfolioScenario({
      positions,
      shockedTickers: new Set(["AAPL", "MSFT"]),
      shockPct: -20,
    });

    expect(result.portfolioImpactPct).toBe(-20);
    expect(result.positions.every((p) => p.wasShocked)).toBe(true);
  });

  it("applies no shock when the shocked set is empty (baseline == scenario)", () => {
    const result = computePortfolioScenario({ positions, shockedTickers: new Set(), shockPct: -50 });

    expect(result.scenarioMarketValue).toBe(result.baselineMarketValue);
    expect(result.portfolioImpact).toBe(0);
  });

  it("computes each position's allocation share of the scenario portfolio", () => {
    const result = computePortfolioScenario({ positions, shockedTickers: new Set(), shockPct: 0 });

    // Equal baseline values (2000 each) -> equal allocation.
    expect(result.positions[0].allocationPct).toBeCloseTo(50);
    expect(result.positions[1].allocationPct).toBeCloseTo(50);
  });
});
