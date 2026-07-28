"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { getOrResolveCompanyByTicker } from "@/features/companies/server/queries";
import { decisionEntrySchema } from "@/features/decision-journal/validation/entry";

/**
 * Records a decision journal entry. Tenant data — forUser() + RLS enforce
 * the entry is written into the caller's own workspace. Never edits or
 * deletes an existing entry from this action (only a separate
 * recordOutcome() does that, for the final-action/outcome-notes fields
 * added later) — the point of a decision journal is an honest record of
 * what you were thinking *at the time*, not a document you can quietly
 * rewrite after seeing what happened.
 */
export async function createDecisionEntry(input: unknown): Promise<{ entryId: string }> {
  const authUser = await requireUser();
  const parsed = decisionEntrySchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  const company = await getOrResolveCompanyByTicker(data.ticker);
  if (!company) {
    throw new AppError("VALIDATION_ERROR", `Could not resolve ticker "${data.ticker}".`);
  }

  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const prisma = forUser(authUser.id);

  const holding = await prisma.holding.findFirst({
    where: { companyId: company.id, portfolio: { workspaceId } },
  });

  const entry = await prisma.decisionJournalEntry.create({
    data: {
      workspaceId,
      companyId: company.id,
      holdingId: holding?.id ?? null,
      decisionDate: new Date(data.decisionDate),
      action: data.action,
      proposedAmount: data.proposedAmount || null,
      evidenceSupporting: data.evidenceSupporting || null,
      evidenceOpposing: data.evidenceOpposing || null,
      currentEmotion: data.currentEmotion,
      confidence: data.confidence,
      thesisImpact: data.thesisImpact || null,
      positionSizeImpact: data.positionSizeImpact || null,
      taxConsiderationNotes: data.taxConsiderationNotes || null,
      whatWouldChangeDecision: data.whatWouldChangeDecision || null,
      wouldBuyIfOwnedNone: data.wouldBuyIfOwnedNone,
      buyingBecauseThesisImprovedNotPriceDrop: data.buyingBecauseThesisImprovedNotPriceDrop,
      belowAllocationCeiling: data.belowAllocationCeiling,
      portfolioAdequatelyDiversified: data.portfolioAdequatelyDiversified,
      newEvidenceForPurchase: data.newEvidenceForPurchase || null,
      evidenceThatWouldProveWrong: data.evidenceThatWouldProveWrong || null,
      reviewDate: data.reviewDate ? new Date(data.reviewDate) : null,
    },
  });

  revalidatePath("/journal");
  return { entryId: entry.id };
}
