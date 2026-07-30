import type { InsiderTransactionClassification } from "@/shared/contracts/insider-transactions-provider";
import type { ContractRecordType } from "@/shared/contracts/government-contracts-provider";
import type { CongressTransactionType } from "@/shared/contracts/congressional-transactions-provider";

export interface ScoringInsiderEvent {
  reportingPersonName: string;
  relationshipCategory: "DIRECTOR" | "OFFICER" | "TEN_PERCENT_OWNER" | "OTHER";
  classification: InsiderTransactionClassification;
  transactionDate: string; // YYYY-MM-DD
  estimatedTotalValue: number | null;
}

export interface ScoringContractEvent {
  recordType: ContractRecordType;
  actionDate: string; // YYYY-MM-DD
  newlyObligatedAmount: number | null;
  /** Null means fully confident (e.g. an exact CIK match) — only a real, sub-1.0 value triggers a penalty. */
  resolutionConfidence: number | null;
}

export interface ScoringCongressEvent {
  politicianName: string;
  transactionType: CongressTransactionType;
  transactionDate: string; // YYYY-MM-DD
  disclosureDelayDays: number;
  resolutionConfidence: number | null;
}

export interface ScoreInput {
  insiderEvents: ScoringInsiderEvent[];
  contractEvents: ScoringContractEvent[];
  congressEvents: ScoringCongressEvent[];
  /** Passed explicitly rather than read from Date.now() — makes recency decay deterministic in tests. */
  asOf: Date;
}

export interface ScoreComponents {
  insider: number;
  governmentContracts: number;
  congress: number;
  convergenceBonus: number;
}

export interface ScoreResult {
  totalScore: number;
  components: ScoreComponents;
  confidence: number;
  categoriesMatched: number;
  explanations: string[];
}

const MAX_INSIDER = 35;
const MAX_CONTRACTS = 30;
const MAX_CONGRESS = 20;
const MAX_CONVERGENCE_TWO = 7;
const MAX_CONVERGENCE_THREE = 15;

/**
 * 1.0 for anything in the last 14 days, decaying linearly to a 0.4 floor
 * by 90 days — a signal from today matters more than the same signal
 * three months ago, but an old signal is never worth literally zero.
 */
function recencyMultiplier(daysAgo: number): number {
  if (daysAgo <= 14) return 1.0;
  if (daysAgo >= 90) return 0.4;
  const t = (daysAgo - 14) / (90 - 14);
  return 1.0 - t * 0.6;
}

function daysSince(dateStr: string, asOf: Date): number {
  const ms = asOf.getTime() - new Date(dateStr + "T00:00:00Z").getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

/**
 * Only OPEN_MARKET_PURCHASE counts as real insider-conviction evidence.
 * "Routine compensation, gifts, option exercises, tax withholding, and
 * automatic transactions should receive little or no positive weight" —
 * they receive none here, deliberately, rather than a token amount that
 * would still nudge the score.
 */
function scoreInsiderEvidence(
  events: ScoringInsiderEvent[],
  asOf: Date,
): { score: number; explanation: string | null } {
  const purchases = events.filter((e) => e.classification === "OPEN_MARKET_PURCHASE");
  if (purchases.length === 0) return { score: 0, explanation: null };

  const distinctBuyers = new Set(purchases.map((p) => p.reportingPersonName));
  const buyerCount = distinctBuyers.size;

  let base = buyerCount === 1 ? 15 : buyerCount === 2 ? 25 : 35;
  const hasOfficer = purchases.some((p) => p.relationshipCategory === "OFFICER");
  if (hasOfficer && buyerCount === 1) base += 5; // seniority bump, only relevant below the multi-buyer cap

  const mostRecentDays = Math.min(...purchases.map((p) => daysSince(p.transactionDate, asOf)));
  const score = Math.min(MAX_INSIDER, Math.round(base * recencyMultiplier(mostRecentDays)));

  const buyerNoun = buyerCount === 1 ? "one insider" : `${buyerCount} independent insiders`;
  const seniorityNote = hasOfficer ? ", including an officer" : "";
  return { score, explanation: `${buyerNoun} reported open-market purchases${seniorityNote}.` };
}

/** Never awards points for a de-obligation or a $0 administrative correction. */
function scoreContractEvidence(
  events: ScoringContractEvent[],
  asOf: Date,
): { score: number; explanation: string | null } {
  const qualifying = events.filter(
    (e) =>
      (e.recordType === "NEW_AWARD" || e.recordType === "MODIFICATION") && (e.newlyObligatedAmount ?? 0) > 0,
  );
  if (qualifying.length === 0) return { score: 0, explanation: null };

  const totalObligated = qualifying.reduce((sum, e) => sum + (e.newlyObligatedAmount ?? 0), 0);
  const base =
    totalObligated >= 100_000_000
      ? 30
      : totalObligated >= 10_000_000
        ? 22
        : totalObligated >= 1_000_000
          ? 15
          : 8;

  const mostRecentDays = Math.min(...qualifying.map((e) => daysSince(e.actionDate, asOf)));
  const avgConfidence =
    qualifying.reduce((sum, e) => sum + (e.resolutionConfidence ?? 1), 0) / qualifying.length;

  const score = Math.min(MAX_CONTRACTS, Math.round(base * recencyMultiplier(mostRecentDays) * avgConfidence));
  const newAwardCount = qualifying.filter((e) => e.recordType === "NEW_AWARD").length;
  const kind = newAwardCount > 0 ? "A new federal award" : "A funded contract modification";
  return { score, explanation: `${kind} was reported.` };
}

/**
 * Only PURCHASE counts toward the score — "do not imply that a
 * congressional trade proves access to non-public information" applies
 * regardless of direction, but a sale carries materially less of the
 * "conviction" signal this whole feature is built around, so it's simply
 * not counted rather than scored with a token weight either direction.
 */
function scoreCongressEvidence(
  events: ScoringCongressEvent[],
  asOf: Date,
): { score: number; explanation: string | null } {
  const purchases = events.filter((e) => e.transactionType === "PURCHASE");
  if (purchases.length === 0) return { score: 0, explanation: null };

  const distinctFilers = new Set(purchases.map((p) => p.politicianName)).size;
  const base = distinctFilers >= 2 ? 20 : 10;

  const mostRecentDays = Math.min(...purchases.map((p) => daysSince(p.transactionDate, asOf)));
  const avgConfidence =
    purchases.reduce((sum, p) => sum + (p.resolutionConfidence ?? 1), 0) / purchases.length;
  // The STOCK Act requires disclosure within 45 days — a much longer
  // delay is itself a data-quality signal worth discounting, separate
  // from ticker-resolution confidence.
  const avgDelay = purchases.reduce((sum, p) => sum + p.disclosureDelayDays, 0) / purchases.length;
  const delayPenalty = avgDelay > 45 ? 0.8 : 1.0;

  const score = Math.min(
    MAX_CONGRESS,
    Math.round(base * recencyMultiplier(mostRecentDays) * avgConfidence * delayPenalty),
  );
  const filerNoun =
    distinctFilers === 1 ? "A congressional purchase" : `${distinctFilers} congressional purchases`;
  return { score, explanation: `${filerNoun} were disclosed.` };
}

function scoreConvergenceBonus(
  categoriesMatched: number,
  components: Omit<ScoreComponents, "convergenceBonus">,
): number {
  if (categoriesMatched < 2) return 0;
  // Scaled by how strong the underlying categories are, not just a flat
  // bonus for merely appearing in >=2 buckets — three weak signals
  // shouldn't outscore two strong ones.
  const strength =
    (components.insider + components.governmentContracts + components.congress) /
    (MAX_INSIDER + MAX_CONTRACTS + MAX_CONGRESS);
  const cap = categoriesMatched >= 3 ? MAX_CONVERGENCE_THREE : MAX_CONVERGENCE_TWO;
  return Math.round(cap * strength);
}

/**
 * The single entry point — pure, deterministic, and the only place score
 * weights live (instructions.md §11: "keep scoring logic in a standalone,
 * testable service with configurable weights"). Never a stock rating or
 * expected-return prediction; every component is explained.
 */
export function computeEvidenceScore(input: ScoreInput): ScoreResult {
  const insider = scoreInsiderEvidence(input.insiderEvents, input.asOf);
  const contracts = scoreContractEvidence(input.contractEvents, input.asOf);
  const congress = scoreCongressEvidence(input.congressEvents, input.asOf);

  const categoriesMatched = [insider.score > 0, contracts.score > 0, congress.score > 0].filter(
    Boolean,
  ).length;
  const convergenceBonus = scoreConvergenceBonus(categoriesMatched, {
    insider: insider.score,
    governmentContracts: contracts.score,
    congress: congress.score,
  });

  const components: ScoreComponents = {
    insider: insider.score,
    governmentContracts: contracts.score,
    congress: congress.score,
    convergenceBonus,
  };
  const totalScore = Math.min(
    100,
    components.insider + components.governmentContracts + components.congress + components.convergenceBonus,
  );

  const allConfidences = [
    ...input.contractEvents.map((e) => e.resolutionConfidence ?? 1),
    ...input.congressEvents.map((e) => e.resolutionConfidence ?? 1),
  ];
  const confidence =
    allConfidences.length > 0 ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length : 1;

  const explanations = [insider.explanation, contracts.explanation, congress.explanation].filter(
    (e): e is string => e !== null,
  );
  if (categoriesMatched >= 2) {
    explanations.push(`Signals detected across ${categoriesMatched} of 3 categories in the selected window.`);
  }

  return {
    totalScore,
    components,
    confidence: Math.round(confidence * 100) / 100,
    categoriesMatched,
    explanations,
  };
}
