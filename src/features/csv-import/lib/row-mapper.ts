import { neutralizeFormulaInjection } from "./neutralize-formula";
import { fnv1aHash } from "./hash";
import {
  CASH_ONLY_TYPES,
  SHARE_AND_PRICE_REQUIRED_TYPES,
  type TransactionTypeValue,
} from "./transaction-types";

export interface ColumnMapping {
  date: number;
  type: number;
  ticker: number | null;
  quantity: number | null;
  price: number | null;
  fees: number | null;
  amount: number | null;
}

export interface NormalizedTransactionRow {
  rowNumber: number;
  occurredAt: string; // ISO date, YYYY-MM-DD
  ticker: string | null; // null for cash-only rows
  type: TransactionTypeValue;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fees: string | null;
  /** Deterministic hash of row content — re-importing the same file produces the same ids, colliding with the DB's uniqueness constraint instead of duplicating. */
  externalId: string;
}

export interface RowIssue {
  rowNumber: number;
  message: string;
}

export interface MapRowsResult {
  valid: NormalizedTransactionRow[];
  skipped: number;
  errors: RowIssue[];
}

const DATE_PATTERNS: { regex: RegExp; order: "ymd" | "mdy" }[] = [
  { regex: /^(\d{4})-(\d{2})-(\d{2})/, order: "ymd" },
  { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})/, order: "mdy" },
];

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  for (const { regex, order } of DATE_PATTERNS) {
    const match = trimmed.match(regex);
    if (!match) continue;
    if (order === "ymd") return `${match[1]}-${match[2]}-${match[3]}`;
    const [, mm, dd, yyyy] = match;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function normalizeNumber(raw: string): string | null {
  const cleaned = raw.trim().replace(/^'/, "").replace(/[$,]/g, "");
  if (cleaned === "") return null;
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return cleaned;
}

/**
 * Never trusts a single value from the uploaded file: every cell is
 * formula-injection-neutralized first, then every field is format- and
 * range-validated before a row is accepted. A row that fails validation
 * goes to `errors`, never silently to `valid` with a guessed/defaulted
 * value. A row whose type maps to "SKIP" is excluded without being
 * reported as an error — the user explicitly chose to exclude that type.
 */
export function mapAndValidateRows(
  rawRows: string[][],
  mapping: ColumnMapping,
  typeValueMapping: Record<string, TransactionTypeValue | "SKIP">,
): MapRowsResult {
  const valid: NormalizedTransactionRow[] = [];
  const errors: RowIssue[] = [];
  let skipped = 0;

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2; // +1 for 1-based, +1 for the header row
    const cells = raw.map(neutralizeFormulaInjection);

    const rawType = (cells[mapping.type] ?? "").trim();
    const mappedType = typeValueMapping[rawType];
    if (!mappedType || mappedType === "SKIP") {
      skipped += 1;
      return;
    }

    const occurredAt = normalizeDate(cells[mapping.date] ?? "");
    if (!occurredAt) {
      errors.push({ rowNumber, message: `Unrecognized date: "${cells[mapping.date] ?? ""}"` });
      return;
    }

    const rawTicker = mapping.ticker !== null ? (cells[mapping.ticker] ?? "").trim().toUpperCase() : "";
    const quantity = mapping.quantity !== null ? normalizeNumber(cells[mapping.quantity] ?? "") : null;
    const price = mapping.price !== null ? normalizeNumber(cells[mapping.price] ?? "") : null;
    const fees = mapping.fees !== null ? normalizeNumber(cells[mapping.fees] ?? "") : null;
    const amount = mapping.amount !== null ? normalizeNumber(cells[mapping.amount] ?? "") : null;

    if (CASH_ONLY_TYPES.has(mappedType)) {
      if (amount === null) {
        errors.push({ rowNumber, message: `${mappedType} rows require a numeric amount` });
        return;
      }
      valid.push({
        rowNumber,
        occurredAt,
        ticker: null,
        type: mappedType,
        quantity: null,
        price: null,
        amount,
        fees,
        externalId: fnv1aHash(`${occurredAt}|CASH|${mappedType}|${amount}`),
      });
      return;
    }

    if (!rawTicker) {
      errors.push({ rowNumber, message: "Missing ticker" });
      return;
    }

    if (SHARE_AND_PRICE_REQUIRED_TYPES.has(mappedType)) {
      if (quantity === null || Number(quantity) <= 0) {
        errors.push({
          rowNumber,
          message: `Missing or invalid quantity: "${cells[mapping.quantity ?? -1] ?? ""}"`,
        });
        return;
      }
      if (price === null || Number(price) < 0) {
        errors.push({
          rowNumber,
          message: `Missing or invalid price: "${cells[mapping.price ?? -1] ?? ""}"`,
        });
        return;
      }
    }

    valid.push({
      rowNumber,
      occurredAt,
      ticker: rawTicker,
      type: mappedType,
      quantity,
      price,
      amount,
      fees,
      externalId: fnv1aHash(
        `${occurredAt}|${rawTicker}|${mappedType}|${quantity ?? ""}|${price ?? ""}|${amount ?? ""}`,
      ),
    });
  });

  return { valid, skipped, errors };
}
