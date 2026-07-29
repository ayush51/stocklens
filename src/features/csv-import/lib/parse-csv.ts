/**
 * Minimal RFC4180-ish CSV parser: handles quoted fields, embedded commas,
 * embedded newlines within quotes, and escaped quotes (""). No external
 * dependency — this is a small, fully-owned state machine rather than
 * `.split(",")`, which silently corrupts any real-world CSV containing a
 * quoted comma (e.g. a description field like "Sold, partial position").
 *
 * Every cell is a raw string — callers are responsible for trimming,
 * type coercion, and validation. Blank trailing lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  function endField() {
    row.push(field);
    field = "";
  }

  function endRow() {
    endField();
    rows.push(row);
    row = [];
  }

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (char === ",") {
      endField();
      i += 1;
      continue;
    }
    if (char === "\r") {
      i += 1; // normalize CRLF/CR — the following \n (if any) triggers endRow
      continue;
    }
    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }
    field += char;
    i += 1;
  }

  // Final field/row if the file doesn't end with a newline.
  if (field.length > 0 || row.length > 0) {
    endRow();
  }

  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export interface ParsedCsv {
  headers: string[];
  rows: string[][];
}

/** Splits the first row off as headers from the rest of the parsed grid. */
export function parseCsvWithHeaders(text: string): ParsedCsv {
  const grid = parseCsv(text);
  const [headers = [], ...rows] = grid;
  return { headers: headers.map((h) => h.trim()), rows };
}
