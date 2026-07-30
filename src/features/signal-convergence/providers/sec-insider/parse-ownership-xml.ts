import { XMLParser } from "fast-xml-parser";

import {
  classifyInsiderTransaction,
  resolveIsPurchase,
  resolveRelationshipCategory,
} from "@/features/signal-convergence/lib/insider-classification";
import type { InsiderTransactionRecord } from "@/shared/contracts/insider-transactions-provider";

const REPEATABLE_TAGS = new Set([
  "nonDerivativeTransaction",
  "derivativeTransaction",
  "nonDerivativeHolding",
  "derivativeHolding",
]);

// parseTagValue: false keeps every leaf as a raw string — share counts and
// prices go through Number()/Decimal at the point of use instead, and CIKs
// (which have meaningful leading zeros) are never silently coerced to a
// number that drops them.
const parser = new XMLParser({
  parseTagValue: false,
  isArray: (name) => REPEATABLE_TAGS.has(name),
});

interface RawValue {
  value?: string;
}

interface RawTransaction {
  transactionDate?: RawValue;
  transactionCoding?: {
    transactionCode?: string;
    footnoteId?: unknown;
  };
  transactionAmounts?: {
    transactionShares?: RawValue;
    transactionPricePerShare?: RawValue;
    transactionAcquiredDisposedCode?: RawValue;
  };
  postTransactionAmounts?: {
    sharesOwnedFollowingTransaction?: RawValue;
  };
  ownershipNature?: {
    directOrIndirectOwnership?: RawValue;
  };
}

interface RawReportingOwner {
  reportingOwnerId?: { rptOwnerName?: string };
  reportingOwnerRelationship?: {
    isDirector?: string;
    isOfficer?: string;
    isTenPercentOwner?: string;
    isOther?: string;
    officerTitle?: string;
  };
}

interface RawOwnershipDocument {
  documentType?: string;
  aff10b5One?: string;
  issuer?: { issuerCik?: string; issuerName?: string };
  reportingOwner?: RawReportingOwner | RawReportingOwner[];
  nonDerivativeTable?: { nonDerivativeTransaction?: RawTransaction[] };
  derivativeTable?: { derivativeTransaction?: RawTransaction[] };
}

function isTruthyFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/**
 * A filing can have more than one <reportingOwner> (e.g. a Section 16 group
 * filing on behalf of several related people) — this app models one
 * InsiderTransactionRecord per (transaction line, reporting owner) pair, so
 * a multi-owner filing contributes one row per owner per transaction.
 */
function normalizeOwners(owner: RawReportingOwner | RawReportingOwner[] | undefined): RawReportingOwner[] {
  if (!owner) return [];
  return Array.isArray(owner) ? owner : [owner];
}

export interface ParsedOwnershipContext {
  accessionNumber: string;
  filingDate: string; // YYYY-MM-DD, from the submissions index — not present in the XML itself
  filingUrl: string;
}

/**
 * Pure parsing — no I/O. Throws on genuinely unparseable input (missing
 * issuer, no reporting owner) rather than silently returning an empty
 * array, so a real parsing failure surfaces as a SourceIngestionError
 * instead of looking like "no transactions in this filing."
 */
export function parseOwnershipXml(xml: string, context: ParsedOwnershipContext): InsiderTransactionRecord[] {
  const parsed = parser.parse(xml) as { ownershipDocument?: RawOwnershipDocument };
  const doc = parsed.ownershipDocument;
  if (!doc?.issuer?.issuerCik || !doc.issuer.issuerName) {
    throw new Error("Ownership XML missing required <issuer> fields");
  }

  const owners = normalizeOwners(doc.reportingOwner);
  if (owners.length === 0) {
    throw new Error("Ownership XML has no <reportingOwner>");
  }

  const is10b51Plan = isTruthyFlag(doc.aff10b5One);
  const isAmendment = (doc.documentType ?? "").includes("/A");

  const records: InsiderTransactionRecord[] = [];
  let lineIndex = 0;

  for (const owner of owners) {
    const relationship = owner.reportingOwnerRelationship;
    const relationshipCategory = resolveRelationshipCategory({
      isDirector: isTruthyFlag(relationship?.isDirector),
      isOfficer: isTruthyFlag(relationship?.isOfficer),
      isTenPercentOwner: isTruthyFlag(relationship?.isTenPercentOwner),
      isOther: isTruthyFlag(relationship?.isOther),
    });
    const reportingPersonName = owner.reportingOwnerId?.rptOwnerName ?? "Unknown";
    const reportingPersonTitle = relationship?.officerTitle || null;

    const allTransactions: RawTransaction[] = [
      ...(doc.nonDerivativeTable?.nonDerivativeTransaction ?? []),
      ...(doc.derivativeTable?.derivativeTransaction ?? []),
    ];

    for (const tx of allTransactions) {
      const transactionCode = tx.transactionCoding?.transactionCode ?? "";
      if (!transactionCode) continue; // a holding-only entry with no coded transaction — not a transaction event

      const acquiredDisposedCode = tx.transactionAmounts?.transactionAcquiredDisposedCode?.value ?? null;
      const shares = tx.transactionAmounts?.transactionShares?.value ?? null;
      const pricePerShare = tx.transactionAmounts?.transactionPricePerShare?.value ?? null;
      const estimatedTotalValue =
        shares !== null && pricePerShare !== null && Number(pricePerShare) > 0
          ? String(Number(shares) * Number(pricePerShare))
          : null;

      records.push({
        issuerCik: doc.issuer.issuerCik,
        issuerName: doc.issuer.issuerName,
        reportingPersonName,
        reportingPersonTitle,
        relationshipCategory,
        transactionDate: tx.transactionDate?.value ?? "",
        filingDate: context.filingDate,
        transactionCode,
        classification: classifyInsiderTransaction(transactionCode, is10b51Plan),
        isPurchase: resolveIsPurchase(acquiredDisposedCode),
        shares,
        pricePerShare,
        estimatedTotalValue,
        ownershipType: tx.ownershipNature?.directOrIndirectOwnership?.value ?? "D",
        sharesOwnedAfter: tx.postTransactionAmounts?.sharesOwnedFollowingTransaction?.value ?? null,
        is10b51Plan,
        isAmendment,
        accessionNumber: context.accessionNumber,
        lineIndex: lineIndex++,
        filingUrl: context.filingUrl,
      });
    }
  }

  return records;
}
