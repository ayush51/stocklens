import { describe, expect, it } from "vitest";

import { parseCsv, parseCsvWithHeaders } from "./parse-csv";

describe("parseCsv", () => {
  it("parses a simple comma-separated grid", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles a quoted field containing a comma", () => {
    expect(parseCsv('a,"b, with comma",c\n1,2,3')).toEqual([
      ["a", "b, with comma", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles an escaped double-quote inside a quoted field", () => {
    expect(parseCsv('a,"he said ""hi""",c')).toEqual([["a", 'he said "hi"', "c"]]);
  });

  it("handles a quoted field containing a newline", () => {
    expect(parseCsv('a,"line1\nline2",c')).toEqual([["a", "line1\nline2", "c"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("handles a file with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("skips blank trailing lines", () => {
    expect(parseCsv("a,b\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseCsvWithHeaders", () => {
  it("splits the first row off as trimmed headers", () => {
    const result = parseCsvWithHeaders(" Date , Ticker \n2026-01-01,AAPL");
    expect(result.headers).toEqual(["Date", "Ticker"]);
    expect(result.rows).toEqual([["2026-01-01", "AAPL"]]);
  });

  it("returns empty headers/rows for empty input", () => {
    const result = parseCsvWithHeaders("");
    expect(result.headers).toEqual([]);
    expect(result.rows).toEqual([]);
  });
});
