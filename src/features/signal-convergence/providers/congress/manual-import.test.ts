import { describe, expect, it } from "vitest";

import { parseManualCongressCsv } from "./manual-import";

const HEADER =
  "politicianName,chamber,state,party,owner,assetNameDisclosed,transactionType,transactionDate,filingDate,reportedRange,filingUrl,externalId";

describe("parseManualCongressCsv", () => {
  it("parses a well-formed row with a real STOCK Act range bucket", () => {
    const csv = `${HEADER}
"Jane Doe",HOUSE,CA,Democrat,SELF,"NVIDIA Corp",PURCHASE,2026-06-01,2026-06-20,"$1,001 - $15,000",https://example.gov/filing/1,house-2026-1`;

    const { records, issues } = parseManualCongressCsv(csv);
    expect(issues).toEqual([]);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      politicianName: "Jane Doe",
      chamber: "HOUSE",
      owner: "SELF",
      assetNameDisclosed: "NVIDIA Corp",
      transactionType: "PURCHASE",
      transactionDate: "2026-06-01",
      filingDate: "2026-06-20",
      reportedRangeMin: "1001",
      reportedRangeMax: "15000",
      externalId: "house-2026-1",
    });
  });

  it("reports a missing required column rather than silently producing wrong data", () => {
    const csv = `politicianName,chamber\n"Jane Doe",HOUSE`;
    const { records, issues } = parseManualCongressCsv(csv);
    expect(records).toEqual([]);
    expect(issues[0].reason).toContain("Missing required columns");
  });

  it("skips a row with an invalid date and reports why, without dropping other valid rows", () => {
    const csv = `${HEADER}
"Jane Doe",HOUSE,CA,Democrat,SELF,"NVIDIA Corp",PURCHASE,not-a-date,2026-06-20,"$1,001 - $15,000",https://example.gov/filing/1,house-2026-1
"John Roe",SENATE,TX,Republican,SPOUSE,"Apple Inc",SALE,2026-05-01,2026-05-15,"$15,001 - $50,000",https://example.gov/filing/2,senate-2026-1`;

    const { records, issues } = parseManualCongressCsv(csv);
    expect(records).toHaveLength(1);
    expect(records[0].externalId).toBe("senate-2026-1");
    expect(issues).toHaveLength(1);
    expect(issues[0].reason).toContain("transactionDate");
  });

  it("rejects a row missing externalId, since that's the deduplication key", () => {
    const csv = `${HEADER}
"Jane Doe",HOUSE,CA,Democrat,SELF,"NVIDIA Corp",PURCHASE,2026-06-01,2026-06-20,"$1,001 - $15,000",https://example.gov/filing/1,`;
    const { records, issues } = parseManualCongressCsv(csv);
    expect(records).toEqual([]);
    expect(issues[0].reason).toContain("externalId");
  });

  it("defaults owner/transactionType to UNKNOWN rather than rejecting when left blank", () => {
    const csv = `${HEADER}
"Jane Doe",HOUSE,CA,Democrat,,"NVIDIA Corp",,2026-06-01,2026-06-20,"$1,001 - $15,000",https://example.gov/filing/1,house-2026-2`;
    const { records, issues } = parseManualCongressCsv(csv);
    expect(issues).toEqual([]);
    expect(records[0].owner).toBe("UNKNOWN");
    expect(records[0].transactionType).toBe("UNKNOWN");
  });
});
