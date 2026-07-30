import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { edgarXbrlMetricsProvider } from "@/features/financial-metrics/providers/edgar-xbrl";

/**
 * DB-first: if we've never fetched statements for this company, populate
 * from EDGAR once and cache; otherwise serve what's cached. No background
 * refresh job exists yet (that's later infra, see
 * docs/phase-0/02-architecture.md §6) — this is a one-time populate, not a
 * staleness-aware refresh.
 */
export async function getFinancialStatementsForCompany(companyId: string, cik: string | null) {
  const existing = await prisma.financialStatement.findMany({
    where: { companyId },
    orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
  });

  if (existing.length > 0 || !cik) {
    return existing;
  }

  const fetched = await edgarXbrlMetricsProvider.getFinancialStatements(cik, { limit: 12 });
  if (fetched.length === 0) {
    return [];
  }

  // Global reference data — same reasoning as Company creation: app_user
  // has no write grant on FinancialStatement, so this goes through the
  // service client even though a user's page view triggered it.
  await prismaService.financialStatement.createMany({
    data: fetched.map((statement) => ({
      companyId,
      fiscalYear: statement.fiscalYear,
      fiscalPeriod: statement.fiscalPeriod,
      revenue: statement.revenue,
      netIncome: statement.netIncome,
      grossProfit: statement.grossProfit,
      eps: statement.eps,
      totalAssets: statement.totalAssets,
      totalLiabilities: statement.totalLiabilities,
      operatingIncome: statement.operatingIncome,
      operatingCashFlow: statement.operatingCashFlow,
      capitalExpenditures: statement.capitalExpenditures,
      cashAndEquivalents: statement.cashAndEquivalents,
      stockBasedCompensation: statement.stockBasedCompensation,
      dividendsPaid: statement.dividendsPaid,
      buybacks: statement.buybacks,
      dilutedSharesOutstanding: statement.dilutedSharesOutstanding,
      sourceUrl: statement.sourceUrl,
    })),
    skipDuplicates: true,
  });

  return prisma.financialStatement.findMany({
    where: { companyId },
    orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
  });
}
