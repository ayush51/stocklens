import { forUser } from "@/lib/db/rls";

/** All decision journal entries for a workspace, newest first. Tenant data — forUser(), never the unscoped prisma import. */
export async function getDecisionEntriesForWorkspace(userId: string, workspaceId: string) {
  const prisma = forUser(userId);

  return prisma.decisionJournalEntry.findMany({
    where: { workspaceId },
    include: { company: true },
    orderBy: { decisionDate: "desc" },
  });
}
