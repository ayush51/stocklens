import { describe, expect, it } from "vitest";

import { mapAndValidateRows, type ColumnMapping } from "./row-mapper";
import type { TransactionTypeValue } from "./transaction-types";

const genericMapping: ColumnMapping = {
  date: 0,
  type: 1,
  ticker: 2,
  quantity: 3,
  price: 4,
  fees: 5,
  amount: null,
};

const typeMap: Record<string, TransactionTypeValue | "SKIP"> = {
  Buy: "BUY",
  Sell: "SELL",
  "Options Expiration": "SKIP",
};

describe("mapAndValidateRows", () => {
  it("maps a valid BUY row", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Buy", "aapl", "10", "150.00", "1.00"]],
      genericMapping,
      typeMap,
    );

    expect(result.errors).toEqual([]);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      occurredAt: "2026-01-15",
      ticker: "AAPL",
      type: "BUY",
      quantity: "10",
      price: "150.00",
      fees: "1.00",
    });
  });

  it("normalizes MM/DD/YYYY dates to ISO", () => {
    const result = mapAndValidateRows(
      [["1/5/2026", "Buy", "AAPL", "10", "150", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.valid[0].occurredAt).toBe("2026-01-05");
  });

  it("skips rows whose type maps to SKIP, without reporting an error", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Options Expiration", "AAPL", "1", "0", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.skipped).toBe(1);
    expect(result.valid).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("skips rows whose raw type value has no mapping at all", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Unknown Code", "AAPL", "1", "1", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it("reports an error for an unrecognized date", () => {
    const result = mapAndValidateRows(
      [["not-a-date", "Buy", "AAPL", "10", "150", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.valid).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/date/i);
  });

  it("reports an error for a missing ticker on a share-based row", () => {
    const result = mapAndValidateRows([["2026-01-15", "Buy", "", "10", "150", ""]], genericMapping, typeMap);
    expect(result.errors[0].message).toMatch(/ticker/i);
  });

  it("reports an error for a non-numeric quantity", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Buy", "AAPL", "ten", "150", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.errors[0].message).toMatch(/quantity/i);
  });

  it("reports an error for a zero or negative quantity", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Buy", "AAPL", "0", "150", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.errors[0].message).toMatch(/quantity/i);
  });

  it("strips $ and , from numeric fields (common spreadsheet formatting)", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Buy", "AAPL", "1,000", "$150.50", ""]],
      genericMapping,
      typeMap,
    );
    expect(result.valid[0].quantity).toBe("1000");
    expect(result.valid[0].price).toBe("150.50");
  });

  it("handles cash-only rows (DEPOSIT) requiring only date and amount", () => {
    const cashMapping: ColumnMapping = {
      date: 0,
      type: 1,
      ticker: null,
      quantity: null,
      price: null,
      fees: null,
      amount: 2,
    };
    const cashTypeMap: Record<string, TransactionTypeValue | "SKIP"> = { "ACH Deposit": "DEPOSIT" };

    const result = mapAndValidateRows([["2026-01-15", "ACH Deposit", "500.00"]], cashMapping, cashTypeMap);

    expect(result.errors).toEqual([]);
    expect(result.valid[0]).toMatchObject({ type: "DEPOSIT", ticker: null, amount: "500.00" });
  });

  it("reports an error when a cash-only row has no numeric amount", () => {
    const cashMapping: ColumnMapping = {
      date: 0,
      type: 1,
      ticker: null,
      quantity: null,
      price: null,
      fees: null,
      amount: 2,
    };
    const cashTypeMap: Record<string, TransactionTypeValue | "SKIP"> = { "ACH Deposit": "DEPOSIT" };

    const result = mapAndValidateRows([["2026-01-15", "ACH Deposit", ""]], cashMapping, cashTypeMap);
    expect(result.errors[0].message).toMatch(/amount/i);
  });

  it("generates identical externalIds for the same row content, enabling idempotent re-import", () => {
    const row = ["2026-01-15", "Buy", "AAPL", "10", "150", ""];
    const result1 = mapAndValidateRows([row], genericMapping, typeMap);
    const result2 = mapAndValidateRows([row], genericMapping, typeMap);
    expect(result1.valid[0].externalId).toBe(result2.valid[0].externalId);
  });

  it("neutralizes formula-injection payloads in the ticker field before validation", () => {
    const result = mapAndValidateRows(
      [["2026-01-15", "Buy", "=cmd|' /c calc'!A0", "10", "150", ""]],
      genericMapping,
      typeMap,
    );
    // The neutralized value starts with an escaped quote, so it no longer
    // resembles a real ticker — but the key property is it's stored as an
    // inert string, never left able to execute as a formula.
    expect(result.valid[0]?.ticker?.startsWith("'=")).toBe(true);
  });

  it("assigns 1-based row numbers accounting for the header row", () => {
    const result = mapAndValidateRows(
      [
        ["2026-01-15", "Buy", "AAPL", "10", "150", ""],
        ["not-a-date", "Buy", "AAPL", "10", "150", ""],
      ],
      genericMapping,
      typeMap,
    );
    expect(result.errors[0].rowNumber).toBe(3); // header is row 1, first data row is row 2
  });
});
