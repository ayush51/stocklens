import { THESIS_TEXT_FIELDS } from "@/features/thesis/validation/thesis";

export interface DiffableThesis {
  title: string;
  summary: string;
  whyMispriced: string | null;
  expectedDrivers: string | null;
  risks: string | null;
  keyAssumptions: string | null;
  timeHorizon: string | null;
  valuationNotes: string | null;
  positionSizingRationale: string | null;
  reasonsToAdd: string | null;
  reasonsToHold: string | null;
  reasonsToTrim: string | null;
  reasonsToExit: string | null;
  invalidationConditions: string | null;
  conviction: string;
  targetPrice: string | null;
}

/**
 * "Show what changed between versions": returns the human-readable labels
 * of every field that differs between two thesis snapshots, in field order.
 * Pure/no I/O so it's directly unit-testable — used both when rendering
 * version history and could back a future "what changed" notification.
 */
export function diffThesisVersions(before: DiffableThesis, after: DiffableThesis): string[] {
  const changed: string[] = [];

  for (const field of THESIS_TEXT_FIELDS) {
    const beforeValue = before[field.key] ?? "";
    const afterValue = after[field.key] ?? "";
    if (beforeValue !== afterValue) {
      changed.push(field.label);
    }
  }

  if (before.conviction !== after.conviction) changed.push("Conviction");
  if ((before.targetPrice ?? "") !== (after.targetPrice ?? "")) changed.push("Target price");

  return changed;
}
