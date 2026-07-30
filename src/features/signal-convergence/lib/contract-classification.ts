import type { ContractRecordType } from "@/shared/contracts/government-contracts-provider";

/**
 * USAspending's transaction feed doesn't expose a single authoritative
 * "is this the original award" boolean — this is inferred from two real,
 * documented fields: modification_number (USAspending's own convention:
 * the base/original award action has no modification number, or "0"),
 * and the award's Base Obligation Date (the award-level start date).
 * Pure and deterministic (instructions.md §11).
 *
 * "Do not interpret every contract modification as a positive signal" —
 * this is exactly why DE_OBLIGATION and CORRECTION are kept separate from
 * MODIFICATION rather than folding everything non-original into one
 * bucket: a $0 administrative action (e.g. "updated MVRS on attachment
 * 1", a real USAspending description seen live) carries none of the
 * signal weight a genuine funds-adding modification does.
 */
export function classifyContractAction(input: {
  modificationNumber: string | null;
  actionDate: string;
  baseObligationDate: string | null;
  federalActionObligation: number;
}): ContractRecordType {
  const isBaseAction =
    (!input.modificationNumber || input.modificationNumber === "0") &&
    input.actionDate === input.baseObligationDate;

  if (isBaseAction) return "NEW_AWARD";
  if (input.federalActionObligation < 0) return "DE_OBLIGATION";
  if (input.federalActionObligation === 0) return "CORRECTION";
  return "MODIFICATION";
}
