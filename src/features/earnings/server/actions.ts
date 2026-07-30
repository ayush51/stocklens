"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { AppError } from "@/lib/errors";
import { earningsReviewSchema } from "@/features/earnings/validation/review";
import { saveEarningsReview } from "@/features/earnings/server/review";

export async function submitEarningsReview(input: unknown): Promise<{ reviewId: string }> {
  const authUser = await requireUser();
  const parsed = earningsReviewSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const result = await saveEarningsReview(authUser.id, workspaceId, parsed.data);

  revalidatePath("/earnings");
  revalidatePath(`/companies/${parsed.data.ticker}/thesis`);
  return result;
}
