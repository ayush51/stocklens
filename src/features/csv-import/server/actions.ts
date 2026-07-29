"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { confirmImportSchema } from "@/features/csv-import/validation/import";
import {
  importCsvRows,
  rollbackImportJob,
  type ImportSummary,
} from "@/features/csv-import/server/import-rows";

export type { ImportSummary };

/**
 * Thin auth/validation wrapper — the actual write path lives in
 * import-rows.ts. Never trusts the client's work at face value even though
 * it already validated/normalized every row (see row-mapper.ts) — every
 * row is re-validated against the same Zod schema here, because a Server
 * Action is a public HTTP endpoint regardless of what UI happens to call
 * it. Tenant data — forUser() + RLS mean a portfolioId outside the
 * caller's own workspace simply resolves to "not found."
 */
export async function confirmCsvImport(input: unknown): Promise<ImportSummary> {
  const authUser = await requireUser();
  const parsed = confirmImportSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const result = await importCsvRows(forUser(authUser.id), parsed.data);
  if ("notFound" in result) {
    throw new AppError("NOT_FOUND", "Portfolio not found.");
  }

  revalidatePath("/imports");
  revalidatePath("/portfolios");
  return result;
}

export async function rollbackCsvImport(jobId: string): Promise<void> {
  const authUser = await requireUser();
  const result = await rollbackImportJob(forUser(authUser.id), jobId);
  if (result && "notFound" in result) {
    throw new AppError("NOT_FOUND", "Import job not found.");
  }

  revalidatePath("/imports");
  revalidatePath("/portfolios");
}
