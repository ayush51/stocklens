"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { criterionFormSchema, evaluationFormSchema } from "@/features/thesis-scorecard/validation/criterion";

/** Adds a criterion to a thesis's scorecard. Tenant data — forUser() + RLS enforce the thesis belongs to the caller's workspace. */
export async function createCriterion(input: unknown): Promise<{ criterionId: string }> {
  const authUser = await requireUser();
  const parsed = criterionFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  const prisma = forUser(authUser.id);
  const criterion = await prisma.thesisCriterion.create({
    data: {
      thesisId: data.thesisId,
      metricLabel: data.metricLabel,
      direction: data.direction,
      ruleType: data.ruleType,
      greenRule: data.greenRule,
      watchRule: data.watchRule,
      redRule: data.redRule,
      greenThreshold: data.greenThreshold || null,
      watchThreshold: data.watchThreshold || null,
      evaluationPeriod: data.evaluationPeriod,
      consecutivePeriodRequirement: data.consecutivePeriodRequirement,
    },
  });

  revalidatePath(`/companies/${data.ticker}/thesis`);
  return { criterionId: criterion.id };
}

/**
 * Records (or corrects, via upsert) one period's evaluation for a
 * criterion. Always marks isManualOverride — the status shown here may
 * have started from suggestCriterionStatus()'s suggestion, but recording
 * it is always a confirmed human judgment call, never an automated write.
 */
export async function recordEvaluation(input: unknown): Promise<void> {
  const authUser = await requireUser();
  const parsed = evaluationFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }
  const data = parsed.data;

  const prisma = forUser(authUser.id);
  await prisma.thesisEvaluation.upsert({
    where: {
      criterionId_fiscalYear_fiscalPeriod: {
        criterionId: data.criterionId,
        fiscalYear: data.fiscalYear,
        fiscalPeriod: data.fiscalPeriod,
      },
    },
    update: {
      currentValue: data.currentValue || null,
      previousValue: data.previousValue || null,
      status: data.status,
      explanation: data.explanation || null,
      source: data.source || null,
      overrideReason: data.overrideReason || null,
      isManualOverride: true,
    },
    create: {
      criterionId: data.criterionId,
      fiscalYear: data.fiscalYear,
      fiscalPeriod: data.fiscalPeriod,
      currentValue: data.currentValue || null,
      previousValue: data.previousValue || null,
      status: data.status,
      explanation: data.explanation || null,
      source: data.source || null,
      overrideReason: data.overrideReason || null,
      isManualOverride: true,
    },
  });

  revalidatePath(`/companies/${data.ticker}/thesis`);
}
