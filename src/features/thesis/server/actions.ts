"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { thesisFormSchema } from "@/features/thesis/validation/thesis";

/**
 * Creates a thesis, or edits the existing one — never overwrites history.
 * On edit, the pre-edit state is snapshotted into an immutable
 * ThesisRevision row *before* Thesis is updated, so every prior version
 * survives and "what changed" is always answerable (see
 * lib/diff-thesis.ts). Tenant data — writes go through forUser(), RLS
 * enforces that companyId/workspaceId actually belong together for this
 * user; there is no separate ownership check to bypass.
 */
export async function saveThesis(input: unknown): Promise<{ thesisId: string }> {
  const authUser = await requireUser();
  const parsed = thesisFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const data = parsed.data;
  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const prisma = forUser(authUser.id);

  const fields = {
    title: data.title,
    summary: data.summary,
    whyMispriced: data.whyMispriced || null,
    expectedDrivers: data.expectedDrivers || null,
    risks: data.risks || null,
    keyAssumptions: data.keyAssumptions || null,
    timeHorizon: data.timeHorizon || null,
    valuationNotes: data.valuationNotes || null,
    positionSizingRationale: data.positionSizingRationale || null,
    reasonsToAdd: data.reasonsToAdd || null,
    reasonsToHold: data.reasonsToHold || null,
    reasonsToTrim: data.reasonsToTrim || null,
    reasonsToExit: data.reasonsToExit || null,
    invalidationConditions: data.invalidationConditions || null,
    nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null,
    sources: data.sources,
    conviction: data.conviction,
    targetPrice: data.targetPrice || null,
    status: data.status,
  };

  const existing = await prisma.thesis.findFirst({ where: { workspaceId, companyId: data.companyId } });

  if (!existing) {
    const thesis = await prisma.thesis.create({
      data: { workspaceId, companyId: data.companyId, ...fields },
    });
    revalidatePath(`/companies/${data.ticker}/thesis`);
    return { thesisId: thesis.id };
  }

  await prisma.thesisRevision.create({
    data: {
      thesisId: existing.id,
      title: existing.title,
      summary: existing.summary,
      whyMispriced: existing.whyMispriced,
      expectedDrivers: existing.expectedDrivers,
      risks: existing.risks,
      keyAssumptions: existing.keyAssumptions,
      timeHorizon: existing.timeHorizon,
      valuationNotes: existing.valuationNotes,
      positionSizingRationale: existing.positionSizingRationale,
      reasonsToAdd: existing.reasonsToAdd,
      reasonsToHold: existing.reasonsToHold,
      reasonsToTrim: existing.reasonsToTrim,
      reasonsToExit: existing.reasonsToExit,
      invalidationConditions: existing.invalidationConditions,
      nextReviewDate: existing.nextReviewDate,
      sources: existing.sources,
      conviction: existing.conviction,
      targetPrice: existing.targetPrice,
      trigger: "MANUAL_EDIT",
    },
  });

  await prisma.thesis.update({ where: { id: existing.id }, data: fields });

  revalidatePath(`/companies/${data.ticker}/thesis`);
  return { thesisId: existing.id };
}
