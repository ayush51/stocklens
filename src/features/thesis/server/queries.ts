import { forUser } from "@/lib/db/rls";

/**
 * A company's current thesis (if any) plus its full revision history, for
 * one workspace. Thesis is tenant data — workspace-scoped via forUser(),
 * never the unscoped `prisma` import.
 */
export async function getThesisForCompany(userId: string, workspaceId: string, companyId: string) {
  const prisma = forUser(userId);

  return prisma.thesis.findFirst({
    where: { workspaceId, companyId },
    include: { revisions: { orderBy: { createdAt: "desc" } } },
  });
}
