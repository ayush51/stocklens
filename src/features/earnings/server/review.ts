import { forUser } from "@/lib/db/rls";
import type { EarningsReviewInput } from "@/features/earnings/validation/review";

/**
 * Core logic, separated from the "use server" action wrapper
 * (actions.ts submitEarningsReview) so it's callable directly from a test
 * with an explicit userId — the action wrapper's requireUser() needs
 * Next's request-scoped cookies(), which doesn't exist outside a real
 * request/render. Same split as getUpcomingEarningsForUser(userId), just
 * for a write path.
 *
 * When affectsThesis is checked and a Thesis already exists for this
 * company, also snapshots the thesis's current state into a
 * ThesisRevision (trigger: EARNINGS_REVIEW) — same snapshot-before-change
 * pattern saveThesis uses for edits, so the thesis's own version history
 * shows it was explicitly reconsidered at this earnings report, even if
 * nothing was edited. If no thesis exists yet for this company, the
 * review is still saved; there's nothing to snapshot.
 */
export async function saveEarningsReview(
  userId: string,
  workspaceId: string,
  data: EarningsReviewInput,
): Promise<{ reviewId: string }> {
  const prisma = forUser(userId);

  let spawnedRevisionId: string | null = null;

  if (data.affectsThesis) {
    const thesis = await prisma.thesis.findFirst({ where: { workspaceId, companyId: data.companyId } });
    if (thesis) {
      const revision = await prisma.thesisRevision.create({
        data: {
          thesisId: thesis.id,
          title: thesis.title,
          summary: thesis.summary,
          whyMispriced: thesis.whyMispriced,
          expectedDrivers: thesis.expectedDrivers,
          risks: thesis.risks,
          keyAssumptions: thesis.keyAssumptions,
          timeHorizon: thesis.timeHorizon,
          valuationNotes: thesis.valuationNotes,
          positionSizingRationale: thesis.positionSizingRationale,
          reasonsToAdd: thesis.reasonsToAdd,
          reasonsToHold: thesis.reasonsToHold,
          reasonsToTrim: thesis.reasonsToTrim,
          reasonsToExit: thesis.reasonsToExit,
          invalidationConditions: thesis.invalidationConditions,
          nextReviewDate: thesis.nextReviewDate,
          sources: thesis.sources,
          conviction: thesis.conviction,
          targetPrice: thesis.targetPrice,
          trigger: "EARNINGS_REVIEW",
        },
      });
      spawnedRevisionId = revision.id;
    }
  }

  const review = await prisma.earningsReview.create({
    data: {
      workspaceId,
      earningsEventId: data.earningsEventId,
      notes: data.notes,
      affectsThesis: data.affectsThesis,
      spawnedRevisionId,
    },
  });

  return { reviewId: review.id };
}
