"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { AppError } from "@/lib/errors";
import { getOrResolveCompanyByTicker } from "@/features/companies/server/queries";
import { recomputeHolding } from "@/features/portfolios/server/service";
import { createPortfolioSchema } from "@/features/portfolios/validation/portfolio";
import { createTransactionSchema } from "@/features/portfolios/validation/transaction";

/** Manual-entry-only write path — CSV import and Robinhood MCP sync have their own, separate write paths (see brokerage-sync/server/ingest.ts and csv-import/server/*). */
export async function createManualPortfolio(input: unknown): Promise<{ portfolioId: string }> {
  const authUser = await requireUser();
  const parsed = createPortfolioSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { workspaceId } = await ensureWorkspaceForUser(authUser);
  const prisma = forUser(authUser.id);
  const portfolio = await prisma.portfolio.create({
    data: { workspaceId, name: parsed.data.name, source: "MANUAL" },
  });

  revalidatePath("/portfolios");
  return { portfolioId: portfolio.id };
}

/**
 * Resolves the ticker to a real Company (same resolution path as every
 * other feature — see docs/phase-0/03-folder-structure.md rule #2), writes
 * the Transaction, then recomputes the Holding from the full transaction
 * history — the same aggregation path CSV import uses, so a manually
 * entered transaction and a CSV-imported one produce identical Holding
 * math.
 */
export async function createManualTransaction(input: unknown): Promise<void> {
  const authUser = await requireUser();
  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const data = parsed.data;
  const prisma = forUser(authUser.id);

  const portfolio = await prisma.portfolio.findUnique({ where: { id: data.portfolioId } });
  if (!portfolio) {
    throw new AppError("NOT_FOUND", "Portfolio not found.");
  }
  if (portfolio.source !== "MANUAL") {
    throw new AppError(
      "VALIDATION_ERROR",
      "Only manually-created portfolios accept manually entered transactions — this one is synced from Robinhood.",
    );
  }

  const company = await getOrResolveCompanyByTicker(data.ticker);
  if (!company) {
    throw new AppError("VALIDATION_ERROR", `Could not resolve ticker "${data.ticker}".`);
  }

  const quantity = Number(data.quantity);
  const price = Number(data.price);
  const fees = data.fees ? Number(data.fees) : 0;
  const amount = quantity * price + fees;

  await prisma.transaction.create({
    data: {
      portfolioId: data.portfolioId,
      companyId: company.id,
      type: data.type,
      quantity: data.quantity,
      price: data.price,
      amount: String(amount),
      fees: data.fees || null,
      occurredAt: new Date(data.occurredAt),
      source: "MANUAL",
    },
  });

  await recomputeHolding(prisma, data.portfolioId, company.id);

  revalidatePath("/portfolios");
}
