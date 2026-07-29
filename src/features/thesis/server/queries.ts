import { forUser } from "@/lib/db/rls";
import { getPortfoliosForUser } from "@/features/portfolios/server/queries";

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

export interface ThesisOverviewRow {
  companyId: string;
  ticker: string;
  name: string;
  allocationPct: string;
  isOverConcentrationThreshold: boolean;
  hasThesis: boolean;
  status: string | null;
  conviction: string | null;
  updatedAt: Date | null;
}

/**
 * Every currently-held company across all the user's portfolios, joined
 * with whether a thesis exists for it — the answer to "which of my real
 * positions still need a thesis," sorted so the largest, most
 * consequential positions are most visible. Reuses getPortfoliosForUser
 * rather than re-querying holdings independently (same reasoning as
 * everywhere else in this codebase: one source of truth for "what do I
 * hold and how much of my portfolio is it").
 */
export async function getThesisOverviewForUser(userId: string): Promise<ThesisOverviewRow[]> {
  const portfolios = await getPortfoliosForUser(userId);
  const holdings = portfolios.flatMap((p) => [...p.stocks, ...p.etfs]);
  if (holdings.length === 0) return [];

  const prisma = forUser(userId);
  const theses = await prisma.thesis.findMany({
    where: { companyId: { in: holdings.map((h) => h.companyId) } },
    select: { companyId: true, status: true, conviction: true, updatedAt: true },
  });
  const thesisByCompany = new Map(theses.map((t) => [t.companyId, t]));

  const rows: ThesisOverviewRow[] = holdings.map((h) => {
    const thesis = thesisByCompany.get(h.companyId);
    return {
      companyId: h.companyId,
      ticker: h.ticker,
      name: h.name,
      allocationPct: h.allocationPct,
      isOverConcentrationThreshold: h.isOverConcentrationThreshold,
      hasThesis: !!thesis,
      status: thesis?.status ?? null,
      conviction: thesis?.conviction ?? null,
      updatedAt: thesis?.updatedAt ?? null,
    };
  });

  return rows.sort((a, b) => Number(b.allocationPct) - Number(a.allocationPct));
}
