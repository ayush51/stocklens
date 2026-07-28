import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { secEdgarFilingsProvider } from "@/features/filings/providers/sec-edgar";

/**
 * DB-first, same one-time-populate pattern as financial-metrics — see
 * docs/phase-0/02-architecture.md §6 for the background-refresh job this
 * will eventually be replaced/supplemented by.
 */
export async function getFilingsForCompany(companyId: string, cik: string | null) {
  const existing = await prisma.secFiling.findMany({
    where: { companyId },
    orderBy: { filedAt: "desc" },
  });

  if (existing.length > 0 || !cik) {
    return existing;
  }

  const fetched = await secEdgarFilingsProvider.listFilingsForCompany(cik, { limit: 20 });
  if (fetched.length === 0) {
    return [];
  }

  // Global reference data — app_user has no write grant on SecFiling, so
  // this goes through the service client even though a user's page view
  // triggered it. Same reasoning as Company/FinancialStatement creation.
  await prismaService.secFiling.createMany({
    data: fetched.map((filing) => ({
      companyId,
      formType: filing.formType,
      accessionNumber: filing.externalId,
      filedAt: new Date(filing.filedAt),
      periodOfReport: filing.periodOfReport ? new Date(filing.periodOfReport) : null,
      documentUrl: filing.documentUrl,
    })),
    skipDuplicates: true,
  });

  return prisma.secFiling.findMany({
    where: { companyId },
    orderBy: { filedAt: "desc" },
  });
}
