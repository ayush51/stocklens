import { prismaService } from "@/lib/db/prisma-service";
import { getOrResolveCompanyByTicker } from "@/features/companies/server/queries";

export interface McpPositionSnapshot {
  ticker: string;
  quantity: string | number;
  averageCost: string | number;
}

export interface McpSyncResult {
  portfolioId: string;
  synced: { ticker: string; companyId: string }[];
  skipped: { ticker: string; reason: string }[];
  closed: { ticker: string; companyId: string }[];
}

/**
 * Writes a Robinhood portfolio snapshot into Supabase. This is the ONLY
 * Robinhood data path in the app: nothing under src/ talks to Robinhood's
 * API, and this function never accepts, stores, or logs a credential.
 *
 * The snapshot must come from Claude calling the read-only robinhood-trading
 * MCP tools (get_equity_positions et al.) inside a chat session the user
 * initiated — see ROBINHOOD_MCP_SECURITY_PLAN.md. The user's Robinhood
 * credentials never leave that MCP session; only the resulting position
 * data (ticker, quantity, average cost) crosses into this function.
 *
 * Runs on the service-role connection because it's a trusted operator
 * action triggered from chat, not a request made on behalf of an
 * authenticated web session — there is no browser request to scope a
 * forUser() client to.
 *
 * A snapshot fully replaces the previous one: positions missing from the
 * new snapshot (fully sold since the last sync) are zeroed out rather than
 * deleted, so a linked Thesis on a since-closed Holding survives.
 */
export async function syncPortfolioFromMcpSnapshot(
  workspaceId: string,
  positions: McpPositionSnapshot[],
): Promise<McpSyncResult> {
  const portfolio = await getOrCreateRobinhoodPortfolio(workspaceId);

  const synced: McpSyncResult["synced"] = [];
  const skipped: McpSyncResult["skipped"] = [];

  for (const position of positions) {
    const company = await resolveHeldCompany(position.ticker);
    if (!company) {
      skipped.push({ ticker: position.ticker, reason: "ticker could not be resolved" });
      continue;
    }

    await prismaService.holding.upsert({
      where: { portfolioId_companyId: { portfolioId: portfolio.id, companyId: company.id } },
      update: { quantity: position.quantity, averageCost: position.averageCost },
      create: {
        portfolioId: portfolio.id,
        companyId: company.id,
        quantity: position.quantity,
        averageCost: position.averageCost,
      },
    });
    synced.push({ ticker: company.ticker, companyId: company.id });
  }

  const syncedCompanyIds = new Set(synced.map((s) => s.companyId));
  const existingHoldings = await prismaService.holding.findMany({
    where: { portfolioId: portfolio.id, quantity: { not: 0 } },
    select: { companyId: true, company: { select: { ticker: true } } },
  });

  const closed: McpSyncResult["closed"] = [];
  for (const holding of existingHoldings) {
    if (syncedCompanyIds.has(holding.companyId)) continue;
    await prismaService.holding.update({
      where: { portfolioId_companyId: { portfolioId: portfolio.id, companyId: holding.companyId } },
      data: { quantity: 0 },
    });
    closed.push({ ticker: holding.company.ticker, companyId: holding.companyId });
  }

  await prismaService.brokerageConnection.upsert({
    where: { portfolioId: portfolio.id },
    update: { status: "CONNECTED", lastSyncedAt: new Date() },
    create: {
      portfolioId: portfolio.id,
      provider: "ROBINHOOD",
      status: "CONNECTED",
      scopes: ["read:positions"],
      lastSyncedAt: new Date(),
    },
  });

  return { portfolioId: portfolio.id, synced, skipped, closed };
}

/**
 * Resolves a ticker held in a real brokerage position to a Company row,
 * falling back to a minimal ETF record when SEC EDGAR has no match.
 *
 * SEC's operating-company ticker list (what getOrResolveCompanyByTicker
 * uses) only covers 10-K filers — funds/ETFs are registered differently and
 * mostly aren't in it. Everywhere else in the app an unresolved ticker means
 * "probably a typo," but here it's a ticker Robinhood itself confirmed the
 * user holds, so treating "not an operating company" as "it's a fund" is
 * safe rather than silently dropping the position.
 */
async function resolveHeldCompany(rawTicker: string) {
  const resolved = await getOrResolveCompanyByTicker(rawTicker);
  if (resolved) return resolved;

  const ticker = rawTicker.trim().toUpperCase();
  if (!ticker) return null;

  return prismaService.company.upsert({
    where: { ticker },
    update: {},
    create: { ticker, name: ticker, assetType: "ETF" },
  });
}

async function getOrCreateRobinhoodPortfolio(workspaceId: string) {
  const existing = await prismaService.portfolio.findFirst({
    where: { workspaceId, source: "ROBINHOOD_SYNC" },
  });
  if (existing) return existing;

  return prismaService.portfolio.create({
    data: { workspaceId, name: "Robinhood", source: "ROBINHOOD_SYNC" },
  });
}
