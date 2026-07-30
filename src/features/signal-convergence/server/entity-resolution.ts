import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { normalizeCompanyName } from "@/features/signal-convergence/lib/normalize-company-name";

export interface ResolutionResult {
  companyId: string;
  confidence: number; // 0-1
  method: string;
}

/**
 * Confidence at or above this auto-links resolvedCompanyId directly.
 * Below it, the match (if any) is only ever a *suggestion* attached to an
 * EntityResolutionReview row — "never force a ticker match when
 * confidence is low" (instructions.md, this feature's own spec).
 */
export const AUTO_ACCEPT_CONFIDENCE = 0.85;

/** SEC CIK is an authoritative identifier — Form 3/4/5 filings always carry the issuer's real CIK. */
export async function resolveCompanyByCik(cik: string): Promise<ResolutionResult | null> {
  const company = await prisma.company.findFirst({ where: { cik } });
  if (!company) return null;
  return { companyId: company.id, confidence: 1.0, method: "SEC_CIK_EXACT" };
}

interface NameIndexEntry {
  companyId: string;
  exactName: string; // lowercased Company.name, for exact match
  normalizedName: string;
}

interface AliasIndexEntry {
  companyId: string;
  alias: string; // lowercased
  verified: boolean;
}

/**
 * Loaded once per caller (not module-level cached) so a long-running
 * process never serves a stale index after a new Company/CompanyAlias row
 * is added — ingestion runs are infrequent enough that re-querying
 * ~dozens of Company rows per run has no real cost.
 */
async function loadResolutionIndex(): Promise<{ names: NameIndexEntry[]; aliases: AliasIndexEntry[] }> {
  const [companies, aliases] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true } }),
    prisma.companyAlias.findMany({ select: { companyId: true, alias: true, verified: true } }),
  ]);

  return {
    names: companies.map((c) => ({
      companyId: c.id,
      exactName: c.name.toLowerCase(),
      normalizedName: normalizeCompanyName(c.name),
    })),
    aliases: aliases.map((a) => ({
      companyId: a.companyId,
      alias: a.alias.toLowerCase(),
      verified: a.verified,
    })),
  };
}

/**
 * Resolves a raw name (a USAspending recipient name, a congressional
 * disclosure's asset name) to a public Company, or null with no
 * confident match. Tries, in order: exact Company.name match, a verified
 * alias, an unverified alias, then normalized-name match — the first
 * confident hit wins. A caller that gets null (or a confidence below
 * AUTO_ACCEPT_CONFIDENCE) should create an EntityResolutionReview row
 * rather than silently drop the event or force the link.
 */
export async function resolveCompanyByName(rawName: string): Promise<ResolutionResult | null> {
  const { names, aliases } = await loadResolutionIndex();
  const lowerRaw = rawName.toLowerCase().trim();

  const exactName = names.find((n) => n.exactName === lowerRaw);
  if (exactName) return { companyId: exactName.companyId, confidence: 1.0, method: "EXACT_NAME" };

  const verifiedAlias = aliases.find((a) => a.alias === lowerRaw && a.verified);
  if (verifiedAlias) return { companyId: verifiedAlias.companyId, confidence: 1.0, method: "VERIFIED_ALIAS" };

  const unverifiedAlias = aliases.find((a) => a.alias === lowerRaw);
  if (unverifiedAlias) return { companyId: unverifiedAlias.companyId, confidence: 0.9, method: "ALIAS" };

  const normalizedRaw = normalizeCompanyName(rawName);
  if (normalizedRaw.length > 0) {
    const normalizedMatch = names.find((n) => n.normalizedName === normalizedRaw);
    if (normalizedMatch) {
      return { companyId: normalizedMatch.companyId, confidence: 0.85, method: "NORMALIZED_NAME" };
    }
  }

  return null;
}

/**
 * Records a name that didn't resolve confidently enough to auto-link, so
 * it surfaces in the review UI rather than silently disappearing. Idempotent
 * on (sourceType, sourceRecordId) — re-running ingestion for the same event
 * updates the existing review row (e.g. a better match becomes available
 * once a new alias is added) instead of creating duplicates.
 */
export async function recordUnresolvedEntity(input: {
  sourceType: "GOVERNMENT_CONTRACT" | "CONGRESSIONAL_TRANSACTION";
  sourceRecordId: string;
  rawName: string;
  suggestion: ResolutionResult | null;
}): Promise<void> {
  await prismaService.entityResolutionReview.upsert({
    where: {
      sourceType_sourceRecordId: {
        sourceType: input.sourceType,
        sourceRecordId: input.sourceRecordId,
      },
    },
    update: {
      rawName: input.rawName,
      suggestedCompanyId: input.suggestion?.companyId ?? null,
      suggestedConfidence: input.suggestion?.confidence ?? null,
    },
    create: {
      sourceType: input.sourceType,
      sourceRecordId: input.sourceRecordId,
      rawName: input.rawName,
      suggestedCompanyId: input.suggestion?.companyId ?? null,
      suggestedConfidence: input.suggestion?.confidence ?? null,
      status: "PENDING",
    },
  });
}
