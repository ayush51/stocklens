"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { createAlertRuleSchema } from "@/features/alerts/validation/alert-rule";
import { evaluateAndRecordAlerts, type AlertEvaluation } from "@/features/alerts/server/evaluate";

export async function createAlertRule(input: unknown): Promise<void> {
  const authUser = await requireUser();
  const parsed = createAlertRuleSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const prisma = forUser(authUser.id);
  const data = parsed.data;

  if (data.type === "THESIS_STALE") {
    const thesis = await prisma.thesis.findUnique({ where: { id: data.thesisId } });
    if (!thesis) throw new AppError("NOT_FOUND", "Thesis not found.");
    await prisma.alertRule.create({
      data: {
        workspaceId,
        type: "THESIS_STALE",
        thesisId: data.thesisId,
        companyId: thesis.companyId,
        config: {},
      },
    });
  } else if (data.type === "UPCOMING_EARNINGS") {
    await prisma.alertRule.create({
      data: {
        workspaceId,
        type: "UPCOMING_EARNINGS",
        companyId: data.companyId,
        config: { daysBefore: data.daysBefore },
      },
    });
  } else {
    await prisma.alertRule.create({
      data: {
        workspaceId,
        type: data.type,
        companyId: data.companyId,
        config: { threshold: data.threshold },
      },
    });
  }

  revalidatePath("/alerts");
}

export async function deleteAlertRule(ruleId: string): Promise<void> {
  const authUser = await requireUser();
  const prisma = forUser(authUser.id);
  await prisma.alertRule.deleteMany({ where: { id: ruleId } });
  revalidatePath("/alerts");
}

export async function toggleAlertRule(ruleId: string, active: boolean): Promise<void> {
  const authUser = await requireUser();
  const prisma = forUser(authUser.id);
  await prisma.alertRule.updateMany({ where: { id: ruleId }, data: { active } });
  revalidatePath("/alerts");
}

/** User-triggered on-demand check — see evaluate.ts's doc comment for why this isn't automatic. */
export async function checkAlertsNow(): Promise<AlertEvaluation[]> {
  const authUser = await requireUser();
  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const results = await evaluateAndRecordAlerts(authUser.id, workspaceId);
  revalidatePath("/alerts");
  return results;
}
