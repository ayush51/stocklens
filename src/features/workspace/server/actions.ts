"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { renameWorkspaceSchema } from "@/features/workspace/validation/workspace";

/** Tenant data write — RLS's workspace_update policy already restricts this to a workspace the signed-in user belongs to; no separate ownership check needed. */
export async function renameWorkspace(input: unknown): Promise<void> {
  const authUser = await requireUser();
  const parsed = renameWorkspaceSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const prisma = forUser(authUser.id);
  const result = await prisma.workspace.updateMany({
    where: { id: parsed.data.workspaceId },
    data: { name: parsed.data.name },
  });
  if (result.count === 0) {
    throw new AppError("NOT_FOUND", "Workspace not found.");
  }

  revalidatePath("/settings/workspace");
}
