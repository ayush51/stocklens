import type {
  InsiderRelationshipCategory,
  InsiderTransactionClassification,
} from "@/shared/contracts/insider-transactions-provider";

/**
 * SEC Form 3/4/5 transaction codes — a fixed, well-documented vocabulary
 * (see SEC's own "Table I/II Transaction Codes" reference). Pure and
 * deterministic (instructions.md §11: "use deterministic code for...
 * classification").
 *
 * "Automatic or planned" is deliberately its own bucket, not folded into
 * open-market purchase/sale — a Rule 10b5-1 scheduled trade is real
 * discretionary intent expressed *in advance*, but the point-in-time
 * transaction itself is not a fresh, information-driven decision the way
 * an unscheduled open-market trade is. Scoring treats them differently on
 * purpose (see the scoring service).
 */
export function classifyInsiderTransaction(
  transactionCode: string,
  is10b51Plan: boolean,
): InsiderTransactionClassification {
  const code = transactionCode.toUpperCase();

  if ((code === "P" || code === "S") && is10b51Plan) return "AUTOMATIC_OR_PLANNED";
  if (code === "P") return "OPEN_MARKET_PURCHASE";
  if (code === "S") return "OPEN_MARKET_SALE";
  if (["M", "C", "O", "X"].includes(code)) return "OPTION_EXERCISE";
  if (code === "A") return "AWARD_OR_GRANT";
  if (code === "G") return "GIFT";
  if (code === "F") return "TAX_WITHHOLDING";
  return "OTHER";
}

/**
 * The XML's own transactionAcquiredDisposedCode ("A"/"D") is the reliable
 * signal for direction — more reliable than inferring purchase/sale from
 * the transaction code letter alone, since several codes (gifts, awards)
 * can appear on either side.
 */
export function resolveIsPurchase(acquiredDisposedCode: string | null): boolean | null {
  if (acquiredDisposedCode === "A") return true;
  if (acquiredDisposedCode === "D") return false;
  return null;
}

/**
 * A reporting person can hold more than one relationship flag at once
 * (e.g. a director who is also an officer) — picks the single strongest
 * category for scoring/display, prioritizing officer > director > 10%
 * owner, since officer seniority is the strongest insider-evidence signal
 * per the scoring spec ("executive seniority").
 */
export function resolveRelationshipCategory(flags: {
  isDirector: boolean;
  isOfficer: boolean;
  isTenPercentOwner: boolean;
  isOther: boolean;
}): InsiderRelationshipCategory {
  if (flags.isOfficer) return "OFFICER";
  if (flags.isDirector) return "DIRECTOR";
  if (flags.isTenPercentOwner) return "TEN_PERCENT_OWNER";
  return "OTHER";
}
