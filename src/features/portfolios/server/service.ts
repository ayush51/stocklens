import { Prisma } from "@/generated/prisma/client";
import type { prismaService } from "@/lib/db/prisma-service";

interface TransactionForAggregate {
  type: "BUY" | "SELL" | "DIVIDEND" | "SPLIT";
  quantity: Prisma.Decimal | string;
  price: Prisma.Decimal | string;
}

export interface HoldingAggregate {
  quantity: Prisma.Decimal;
  averageCost: Prisma.Decimal;
  /**
   * Cumulative realized gain/loss across every SELL in the history, using
   * the weighted-average cost at the moment of each sale. Re-derived from
   * scratch each time (like quantity/averageCost), so a full sell-to-zero
   * followed by a fresh buy correctly keeps the earlier round trip's
   * realized P&L rather than losing it.
   */
  realizedGainLoss: Prisma.Decimal;
}

/**
 * Weighted-average-cost aggregation over a company's transaction history
 * within one portfolio. Pure function — no I/O — so it's unit-testable
 * without a database. DIVIDEND/SPLIT rows don't affect share count here
 * (dividends are treated as cash events, not DRIP).
 *
 * SELL reduces quantity without changing the running average cost, which is
 * standard weighted-average-cost behavior (as opposed to FIFO/LIFO lot
 * tracking, which docs/phase-0/04-database-design.md explicitly scopes out
 * of Holding).
 */
export function computeHoldingAggregate(transactions: TransactionForAggregate[]): HoldingAggregate {
  let quantity = new Prisma.Decimal(0);
  let totalCost = new Prisma.Decimal(0);
  let realizedGainLoss = new Prisma.Decimal(0);

  for (const tx of transactions) {
    const txQuantity = new Prisma.Decimal(tx.quantity);
    const txPrice = new Prisma.Decimal(tx.price);

    if (tx.type === "BUY") {
      totalCost = totalCost.plus(txQuantity.times(txPrice));
      quantity = quantity.plus(txQuantity);
    } else if (tx.type === "SELL") {
      if (quantity.greaterThan(0)) {
        const averageCost = totalCost.dividedBy(quantity);
        totalCost = totalCost.minus(averageCost.times(txQuantity));
        realizedGainLoss = realizedGainLoss.plus(txPrice.minus(averageCost).times(txQuantity));
      }
      quantity = quantity.minus(txQuantity);
    }
    // DIVIDEND, SPLIT: no effect on quantity/cost basis in this pass.
  }

  const averageCost = quantity.greaterThan(0) ? totalCost.dividedBy(quantity) : new Prisma.Decimal(0);

  return { quantity, averageCost, realizedGainLoss };
}

/**
 * Re-derives a Holding row from a company's full Transaction history in a
 * portfolio and upserts it. Never deletes on a full sell-out (quantity=0)
 * — a closed position may still carry a linked Thesis, and "no shares left"
 * is a UI filter on the holdings list, not a reason to lose the row.
 */
export async function recomputeHolding(
  prisma: typeof prismaService,
  portfolioId: string,
  companyId: string,
): Promise<void> {
  const transactions = await prisma.transaction.findMany({
    where: { portfolioId, companyId },
    orderBy: { occurredAt: "asc" },
    select: { type: true, quantity: true, price: true },
  });

  const { quantity, averageCost, realizedGainLoss } = computeHoldingAggregate(transactions);

  await prisma.holding.upsert({
    where: { portfolioId_companyId: { portfolioId, companyId } },
    update: { quantity, averageCost, realizedGainLoss },
    create: { portfolioId, companyId, quantity, averageCost, realizedGainLoss },
  });
}
