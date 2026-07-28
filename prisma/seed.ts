import { prisma } from "@/lib/db/prisma";

/**
 * Synthetic dev-seed data. Always at least two unrelated tickers — see
 * docs/phase-0/01-prd.md §4 (multi-ticker discipline: no fixture may imply
 * this product is coupled to a single company).
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
