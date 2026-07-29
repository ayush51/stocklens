import { Prisma } from "@/generated/prisma/client";
import type { prismaService } from "@/lib/db/prisma-service";
import type { ScopedPrismaClient } from "@/lib/db/rls";

export type AggregateTransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "DIVIDEND_REINVESTMENT"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "FEE"
  | "INTEREST"
  | "SPLIT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT";

interface TransactionForAggregate {
  type: AggregateTransactionType;
  // Null for cash-only rows (DEPOSIT/WITHDRAWAL/FEE/INTEREST) — these never
  // affect share count/cost basis, so a null quantity/price is simply
  // skipped rather than treated as zero.
  quantity: Prisma.Decimal | string | null;
  price: Prisma.Decimal | string | null;
}

/** Types that increase share count/cost basis like a purchase — a DRIP buy or an incoming security transfer is economically the same as a BUY. */
const BUY_LIKE = new Set<AggregateTransactionType>(["BUY", "DIVIDEND_REINVESTMENT", "TRANSFER_IN"]);
/** Types that decrease share count and realize gain/loss like a sale. */
const SELL_LIKE = new Set<AggregateTransactionType>(["SELL", "TRANSFER_OUT"]);

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
 * without a database.
 *
 * BUY/DIVIDEND_REINVESTMENT/TRANSFER_IN all increase share count and cost
 * basis identically (a DRIP purchase or an incoming ACAT transfer is
 * economically the same as a BUY at that price). SELL/TRANSFER_OUT both
 * reduce quantity and realize gain/loss the same way, without changing the
 * running average cost — standard weighted-average-cost behavior (as
 * opposed to FIFO/LIFO lot tracking, which docs/phase-0/04-database-
 * design.md explicitly scopes out of Holding). DIVIDEND (cash, not
 * reinvested) and SPLIT (no ratio field exists to apply correctly — see
 * the schema) are no-ops here, along with every cash-only type
 * (DEPOSIT/WITHDRAWAL/FEE/INTEREST), which never even reach this function
 * in practice since recomputeHolding's query is scoped to one companyId.
 */
export function computeHoldingAggregate(transactions: TransactionForAggregate[]): HoldingAggregate {
  let quantity = new Prisma.Decimal(0);
  let totalCost = new Prisma.Decimal(0);
  let realizedGainLoss = new Prisma.Decimal(0);

  for (const tx of transactions) {
    if (tx.quantity === null || tx.price === null) continue;
    const txQuantity = new Prisma.Decimal(tx.quantity);
    const txPrice = new Prisma.Decimal(tx.price);

    if (BUY_LIKE.has(tx.type)) {
      totalCost = totalCost.plus(txQuantity.times(txPrice));
      quantity = quantity.plus(txQuantity);
    } else if (SELL_LIKE.has(tx.type)) {
      if (quantity.greaterThan(0)) {
        const averageCost = totalCost.dividedBy(quantity);
        totalCost = totalCost.minus(averageCost.times(txQuantity));
        realizedGainLoss = realizedGainLoss.plus(txPrice.minus(averageCost).times(txQuantity));
      }
      quantity = quantity.minus(txQuantity);
    }
    // DIVIDEND, SPLIT, and cash-only types: no effect on quantity/cost basis.
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
  prisma: typeof prismaService | ScopedPrismaClient,
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
