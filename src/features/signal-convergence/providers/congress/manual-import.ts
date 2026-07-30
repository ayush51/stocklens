import { parseCsvWithHeaders } from "@/features/csv-import/lib/parse-csv";
import { parseAmountRange } from "@/features/signal-convergence/lib/parse-amount-range";
import type {
  CongressChamber,
  CongressionalTransactionRecord,
  CongressOwner,
  CongressTransactionType,
} from "@/shared/contracts/congressional-transactions-provider";

const EXPECTED_COLUMNS = [
  "politicianName",
  "chamber",
  "state",
  "party",
  "owner",
  "assetNameDisclosed",
  "transactionType",
  "transactionDate",
  "filingDate",
  "reportedRange",
  "filingUrl",
  "externalId",
] as const;

const CHAMBERS = new Set<CongressChamber>(["HOUSE", "SENATE"]);
const OWNERS = new Set<CongressOwner>(["SELF", "SPOUSE", "DEPENDENT", "JOINT", "UNKNOWN"]);
const TRANSACTION_TYPES = new Set<CongressTransactionType>(["PURCHASE", "SALE", "EXCHANGE", "UNKNOWN"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ManualImportIssue {
  row: number;
  reason: string;
}

export interface ManualImportResult {
  records: CongressionalTransactionRecord[];
  issues: ManualImportIssue[];
}

/**
 * Validates and sanitizes every row rather than trusting the file: a bad
 * row is skipped and reported (not silently dropped, not left to crash
 * the whole import) — "validate imported files" / "sanitize
 * source-provided text" from this feature's security requirements.
 * Plain string fields are trimmed and length-capped; nothing here is ever
 * rendered as HTML, so no markup sanitization beyond that is needed.
 */
export function parseManualCongressCsv(csvText: string): ManualImportResult {
  const { headers, rows } = parseCsvWithHeaders(csvText);
  const missingColumns = EXPECTED_COLUMNS.filter((col) => !headers.includes(col));
  if (missingColumns.length > 0) {
    return {
      records: [],
      issues: [{ row: 0, reason: `Missing required columns: ${missingColumns.join(", ")}` }],
    };
  }

  const columnIndex = new Map(headers.map((h, i) => [h, i]));
  const records: CongressionalTransactionRecord[] = [];
  const issues: ManualImportIssue[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // +1 for 1-indexing, +1 for the header row
    const get = (col: (typeof EXPECTED_COLUMNS)[number]) =>
      (row[columnIndex.get(col)!] ?? "").trim().slice(0, 500);

    const politicianName = get("politicianName");
    const chamber = get("chamber").toUpperCase() as CongressChamber;
    const owner = (get("owner").toUpperCase() || "UNKNOWN") as CongressOwner;
    const transactionType = (get("transactionType").toUpperCase() || "UNKNOWN") as CongressTransactionType;
    const transactionDate = get("transactionDate");
    const filingDate = get("filingDate");
    const externalId = get("externalId");
    const assetNameDisclosed = get("assetNameDisclosed");

    if (!politicianName) return issues.push({ row: rowNumber, reason: "Missing politicianName" });
    if (!CHAMBERS.has(chamber))
      return issues.push({ row: rowNumber, reason: `Invalid chamber "${chamber}"` });
    if (!assetNameDisclosed) return issues.push({ row: rowNumber, reason: "Missing assetNameDisclosed" });
    if (!DATE_PATTERN.test(transactionDate)) {
      return issues.push({
        row: rowNumber,
        reason: `Invalid transactionDate "${transactionDate}" (expected YYYY-MM-DD)`,
      });
    }
    if (!DATE_PATTERN.test(filingDate)) {
      return issues.push({
        row: rowNumber,
        reason: `Invalid filingDate "${filingDate}" (expected YYYY-MM-DD)`,
      });
    }
    if (!externalId)
      return issues.push({ row: rowNumber, reason: "Missing externalId (required for deduplication)" });
    if (!OWNERS.has(owner)) return issues.push({ row: rowNumber, reason: `Invalid owner "${owner}"` });
    if (!TRANSACTION_TYPES.has(transactionType)) {
      return issues.push({ row: rowNumber, reason: `Invalid transactionType "${transactionType}"` });
    }

    const range = parseAmountRange(get("reportedRange"));

    records.push({
      politicianName,
      chamber,
      state: get("state") || null,
      party: get("party") || null,
      owner,
      assetNameDisclosed,
      transactionType,
      transactionDate,
      filingDate,
      reportedRangeMin: range.min !== null ? String(range.min) : null,
      reportedRangeMax: range.max !== null ? String(range.max) : null,
      filingUrl: get("filingUrl") || null,
      externalId,
    });
  });

  return { records, issues };
}
