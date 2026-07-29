import type { ScopedPrismaClient } from "@/lib/db/rls";
import { getOrResolveCompanyByTicker } from "@/features/companies/server/queries";
import { recomputeHolding } from "@/features/portfolios/server/service";
import type { ConfirmImportInput } from "@/features/csv-import/validation/import";

export interface ImportSummary {
  jobId: string;
  imported: number;
  duplicates: number;
  failed: number;
  errors: { rowNumber: number; message: string }[];
}

/**
 * Core CSV-import write path, separated from the "use server" Server
 * Action wrapper (actions.ts) specifically so it's callable without a real
 * request/cookie context — requireUser() (which the Server Action calls
 * before this) throws outside an actual HTTP request, which would make
 * this logic impossible to exercise from a script or a future non-HTTP
 * caller. The auth gate and the business logic are two different
 * concerns; only the former needs a request.
 *
 * Duplicate detection: rows carry a deterministic externalId (hash of row
 * content — see row-mapper.ts), so re-importing the same file produces the
 * same ids. Existing ids are looked up first and excluded before insert,
 * so the reported duplicate count is exact, not just "some rows were
 * skipped."
 */
export async function importCsvRows(
  prisma: ScopedPrismaClient,
  input: ConfirmImportInput,
): Promise<ImportSummary | { notFound: true }> {
  const { portfolioId, filename, checksum, columnMapping, rows } = input;

  const portfolio = await prisma.portfolio.findUnique({ where: { id: portfolioId } });
  if (!portfolio) {
    return { notFound: true };
  }

  const job = await prisma.csvImportJob.create({
    data: { portfolioId, status: "PROCESSING", filename, checksum, columnMapping, rowsTotal: rows.length },
  });

  const distinctTickers = [...new Set(rows.map((r) => r.ticker).filter((t): t is string => t !== null))];
  const companyIdByTicker = new Map<string, string>();
  const unresolvedTickers = new Set<string>();

  for (const ticker of distinctTickers) {
    const company = await getOrResolveCompanyByTicker(ticker);
    if (company) companyIdByTicker.set(ticker, company.id);
    else unresolvedTickers.add(ticker);
  }

  const errors: { rowNumber: number; message: string }[] = [];
  const resolvedRows = rows.filter((row) => {
    if (row.ticker && unresolvedTickers.has(row.ticker)) {
      errors.push({ rowNumber: row.rowNumber, message: `Could not resolve ticker "${row.ticker}"` });
      return false;
    }
    return true;
  });

  const existing = await prisma.transaction.findMany({
    where: { portfolioId, externalId: { in: resolvedRows.map((r) => r.externalId) } },
    select: { externalId: true },
  });
  const existingIds = new Set(existing.map((e) => e.externalId));
  const rowsToInsert = resolvedRows.filter((row) => !existingIds.has(row.externalId));
  const duplicateCount = resolvedRows.length - rowsToInsert.length;

  if (rowsToInsert.length > 0) {
    await prisma.transaction.createMany({
      data: rowsToInsert.map((row) => ({
        portfolioId,
        companyId: row.ticker ? (companyIdByTicker.get(row.ticker) ?? null) : null,
        csvImportJobId: job.id,
        type: row.type,
        quantity: row.quantity,
        price: row.price,
        amount: row.amount,
        fees: row.fees,
        occurredAt: new Date(row.occurredAt),
        source: "CSV_IMPORT",
        externalId: row.externalId,
      })),
    });
  }

  const affectedCompanyIds = new Set(
    rowsToInsert
      .map((row) => (row.ticker ? companyIdByTicker.get(row.ticker) : null))
      .filter((id): id is string => !!id),
  );
  for (const companyId of affectedCompanyIds) {
    await recomputeHolding(prisma, portfolioId, companyId);
  }

  await prisma.csvImportJob.update({
    where: { id: job.id },
    data: {
      status: "COMPLETED",
      rowsSucceeded: rowsToInsert.length,
      rowsDuplicate: duplicateCount,
      rowsFailed: errors.length,
      errorDetail: errors.length > 0 ? errors : undefined,
      completedAt: new Date(),
    },
  });

  return {
    jobId: job.id,
    imported: rowsToInsert.length,
    duplicates: duplicateCount,
    failed: errors.length,
    errors,
  };
}

/**
 * Deletes every transaction created by one import job and recomputes the
 * holdings that touches. The job record itself is kept (with
 * rolledBackAt set) rather than deleted, so it stays visible in import
 * history as "rolled back" instead of just disappearing.
 */
export async function rollbackImportJob(
  prisma: ScopedPrismaClient,
  jobId: string,
): Promise<{ notFound: true } | void> {
  const job = await prisma.csvImportJob.findUnique({ where: { id: jobId } });
  if (!job) {
    return { notFound: true };
  }

  const transactions = await prisma.transaction.findMany({
    where: { csvImportJobId: jobId },
    select: { companyId: true },
  });
  const affectedCompanyIds = new Set(transactions.map((t) => t.companyId).filter((id): id is string => !!id));

  await prisma.transaction.deleteMany({ where: { csvImportJobId: jobId } });

  for (const companyId of affectedCompanyIds) {
    await recomputeHolding(prisma, job.portfolioId, companyId);
  }

  await prisma.csvImportJob.update({ where: { id: jobId }, data: { rolledBackAt: new Date() } });
}
