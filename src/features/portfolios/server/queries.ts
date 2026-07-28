import { forUser } from "@/lib/db/rls";

export interface HoldingRow {
  companyId: string;
  ticker: string;
  name: string;
  quantity: string;
  averageCost: string;
  costBasis: string;
}

export interface PortfolioSummary {
  id: string;
  name: string;
  source: string;
  lastSyncedAt: Date | null;
  stocks: HoldingRow[];
  etfs: HoldingRow[];
}

/**
 * All of a user's portfolios with non-zero holdings, split into stocks and
 * ETFs for display (see Company.assetType — ETFs resolve with no SEC CIK,
 * so they're bucketed separately rather than mixed in with fundamentals-
 * backed holdings).
 *
 * RLS-scoped: Portfolio/Holding are tenant data, so this must go through
 * forUser(), never the service client.
 */
export async function getPortfoliosForUser(userId: string): Promise<PortfolioSummary[]> {
  const prisma = forUser(userId);

  const portfolios = await prisma.portfolio.findMany({
    include: {
      brokerageConnection: true,
      holdings: {
        where: { quantity: { not: 0 } },
        include: { company: true },
        orderBy: { company: { ticker: "asc" } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return portfolios.map((portfolio) => {
    const stocks: HoldingRow[] = [];
    const etfs: HoldingRow[] = [];

    for (const holding of portfolio.holdings) {
      const row: HoldingRow = {
        companyId: holding.companyId,
        ticker: holding.company.ticker,
        name: holding.company.name,
        quantity: holding.quantity.toString(),
        averageCost: holding.averageCost.toString(),
        costBasis: holding.quantity.times(holding.averageCost).toFixed(2),
      };
      (holding.company.assetType === "ETF" ? etfs : stocks).push(row);
    }

    return {
      id: portfolio.id,
      name: portfolio.name,
      source: portfolio.source,
      lastSyncedAt: portfolio.brokerageConnection?.lastSyncedAt ?? null,
      stocks,
      etfs,
    };
  });
}
