import { describe, expect, it } from "vitest";

import { normalizeTicker } from "./normalize-ticker";

describe("normalizeTicker", () => {
  it("uppercases and trims", () => {
    expect(normalizeTicker("  aapl  ")).toBe("AAPL");
  });

  it("is idempotent", () => {
    expect(normalizeTicker(normalizeTicker("msft"))).toBe("MSFT");
  });

  it("leaves an already-normalized ticker unchanged", () => {
    expect(normalizeTicker("NVDA")).toBe("NVDA");
  });

  it("returns an empty string for blank input rather than throwing", () => {
    expect(normalizeTicker("   ")).toBe("");
  });
});
