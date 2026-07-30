"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";

/**
 * Confirms a suggested (or manually chosen) company for a pending
 * EntityResolutionReview row, and — since this is a real human
 * confirmation, not a guess — also writes a verified CompanyAlias for
 * the raw name, so the same recipient/asset name resolves automatically
 * on every future ingestion run instead of landing back in review.
 */
export async function confirmEntityResolution(reviewId: string, companyId: string): Promise<void> {
  await requireUser();

  const review = await prismaService.entityResolutionReview.findUnique({ where: { id: reviewId } });
  if (!review) throw new AppError("NOT_FOUND", "Review entry not found.");

  await prismaService.$transaction([
    prismaService.entityResolutionReview.update({
      where: { id: reviewId },
      data: { status: "CONFIRMED", resolvedCompanyId: companyId, resolvedAt: new Date() },
    }),
    prismaService.companyAlias.upsert({
      where: { companyId_alias_aliasType: { companyId, alias: review.rawName, aliasType: "MANUAL_ALIAS" } },
      update: { verified: true },
      create: {
        companyId,
        alias: review.rawName,
        aliasType: "MANUAL_ALIAS",
        source: "entity_resolution_review",
        verified: true,
      },
    }),
  ]);

  revalidatePath("/signal-convergence/data-health");
}

export async function rejectEntityResolution(reviewId: string, notes?: string): Promise<void> {
  await requireUser();

  await prismaService.entityResolutionReview.update({
    where: { id: reviewId },
    data: { status: "REJECTED", resolvedAt: new Date(), notes: notes ?? null },
  });

  revalidatePath("/signal-convergence/data-health");
}
