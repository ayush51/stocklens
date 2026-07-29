import { forUser } from "@/lib/db/rls";

/** Import history across every portfolio in a workspace, newest first. Tenant data — forUser(), never the unscoped prisma import. */
export async function getCsvImportHistoryForWorkspace(userId: string, workspaceId: string) {
  const prisma = forUser(userId);

  return prisma.csvImportJob.findMany({
    where: { portfolio: { workspaceId } },
    include: { portfolio: true },
    orderBy: { createdAt: "desc" },
  });
}

/** Portfolios available as an import target. */
export async function getPortfoliosForImportTarget(userId: string, workspaceId: string) {
  const prisma = forUser(userId);

  return prisma.portfolio.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, source: true },
  });
}
