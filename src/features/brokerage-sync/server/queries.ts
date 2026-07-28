import type { ScopedPrismaClient } from "@/lib/db/rls";

/** There's at most one Robinhood connection per workspace in V1 — one broker, one auto-created portfolio. */
export async function getRobinhoodConnection(prisma: ScopedPrismaClient, workspaceId: string) {
  const portfolio = await prisma.portfolio.findFirst({
    where: { workspaceId, source: "ROBINHOOD_SYNC" },
    include: { brokerageConnection: true },
  });

  if (!portfolio?.brokerageConnection) {
    return null;
  }

  return { portfolio, connection: portfolio.brokerageConnection };
}
