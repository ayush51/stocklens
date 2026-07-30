import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseOwnershipXml } from "./parse-ownership-xml";

function loadFixture(name: string): string {
  return readFileSync(join(__dirname, "__fixtures__", name), "utf-8");
}

const context = {
  accessionNumber: "0000000000-00-000000",
  filingDate: "2026-01-01",
  filingUrl: "https://www.sec.gov/example",
};

describe("parseOwnershipXml", () => {
  it("parses a real NVDA Form 4 gift filing (verified live 2026-07-30) with a 10b5-1 footnote reference", () => {
    const xml = loadFixture("nvda-form4-gift.xml");
    const records = parseOwnershipXml(xml, context);

    expect(records).toHaveLength(1);
    const record = records[0];
    expect(record.issuerCik).toBe("0001045810"); // leading zeros preserved, not coerced to a number
    expect(record.issuerName).toBe("NVIDIA CORP");
    expect(record.reportingPersonName).toBe("COXE TENCH");
    expect(record.relationshipCategory).toBe("DIRECTOR");
    expect(record.transactionCode).toBe("G");
    expect(record.classification).toBe("GIFT");
    expect(record.isPurchase).toBe(false); // acquiredDisposedCode "D"
    expect(record.shares).toBe("500000");
    expect(record.is10b51Plan).toBe(true); // document-level aff10b5One = "1"
    expect(record.isAmendment).toBe(false);
    expect(record.ownershipType).toBe("I");
    expect(record.sharesOwnedAfter).toBe("25171360");
  });

  it("parses a real AAPL Form 4 with multiple transactions, a derivative RSU exercise, word-form booleans, and a footnote-only (missing) price", () => {
    const xml = loadFixture("aapl-form4-rsu-vesting.xml");
    const records = parseOwnershipXml(xml, context);

    // 2 non-derivative + 1 derivative transaction in this real filing.
    expect(records).toHaveLength(3);
    expect(records.every((r) => r.issuerCik === "0000320193")).toBe(true);
    expect(records.every((r) => r.reportingPersonName === "Newstead Jennifer")).toBe(true);
    expect(records.every((r) => r.relationshipCategory === "OFFICER")).toBe(true);
    expect(records.every((r) => r.reportingPersonTitle === "SVP, GC and Secretary")).toBe(true);
    // <isOfficer>true</isOfficer> and <aff10b5One>false</aff10b5One> — word-form
    // booleans (a real filer-agent dialect difference from NVDA's "1"/"0").
    expect(records.every((r) => r.is10b51Plan === false)).toBe(true);

    const rsuVesting = records[0];
    expect(rsuVesting.transactionCode).toBe("M");
    expect(rsuVesting.classification).toBe("OPTION_EXERCISE");
    expect(rsuVesting.isPurchase).toBe(true); // acquiredDisposedCode "A"
    expect(rsuVesting.shares).toBe("30104");
    // <transactionPricePerShare><footnoteId .../></transactionPricePerShare> —
    // no <value> at all for this real vesting transaction.
    expect(rsuVesting.pricePerShare).toBeNull();
    expect(rsuVesting.estimatedTotalValue).toBeNull();

    const taxWithholding = records[1];
    expect(taxWithholding.transactionCode).toBe("F");
    expect(taxWithholding.classification).toBe("TAX_WITHHOLDING");
    expect(taxWithholding.isPurchase).toBe(false);
    expect(taxWithholding.shares).toBe("16238");
    expect(taxWithholding.pricePerShare).toBe("296.42");
    expect(taxWithholding.estimatedTotalValue).toBe(String(16238 * 296.42));

    const derivativeExercise = records[2];
    expect(derivativeExercise.transactionCode).toBe("M");
    expect(derivativeExercise.classification).toBe("OPTION_EXERCISE");
  });

  it("assigns sequential lineIndex values that are unique within a filing (dedup key component)", () => {
    const xml = loadFixture("aapl-form4-rsu-vesting.xml");
    const records = parseOwnershipXml(xml, context);
    expect(records.map((r) => r.lineIndex)).toEqual([0, 1, 2]);
  });

  it("throws rather than silently returning an empty array when required fields are missing", () => {
    const brokenXml = `<?xml version="1.0"?><ownershipDocument></ownershipDocument>`;
    expect(() => parseOwnershipXml(brokenXml, context)).toThrow();
  });
});
