import "dotenv/config"; // standalone entry point — Next.js loads .env itself, but this script doesn't run through Next

import { prismaService as prisma } from "@/lib/db/prisma-service";

/**
 * Synthetic dev-seed data. Always at least two unrelated tickers — see
 * docs/phase-0/01-prd.md §4 (multi-ticker discipline: no fixture may imply
 * this product is coupled to a single company).
 *
 * Uses the service-role client: Company is a global reference table, and
 * app_user (the default RLS-scoped client) has no write grant on it —
 * only trusted system code (this seed script, background ingestion jobs)
 * can write global reference data. See docs/phase-0/09-security-model.md §2-3.
 */
async function main() {
  const [appleCo, msftCo] = await Promise.all([
    prisma.company.upsert({
      where: { ticker: "AAPL" },
      update: {},
      create: { ticker: "AAPL", name: "Apple Inc.", exchange: "NASDAQ", sector: "Technology" },
    }),
    prisma.company.upsert({
      where: { ticker: "MSFT" },
      update: {},
      create: { ticker: "MSFT", name: "Microsoft Corporation", exchange: "NASDAQ", sector: "Technology" },
    }),
  ]);

  console.log("Seeded companies:", appleCo.ticker, msftCo.ticker);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
