"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ensureWorkspaceForUser } from "@/lib/auth/ensure-workspace";
import { forUser } from "@/lib/db/rls";
import { prismaService } from "@/lib/db/prisma-service";
import { getOrResolveCompanyByTicker } from "@/features/companies/server/queries";
import { recomputeHolding } from "@/features/portfolios/server/service";
import { robinhoodBrokerageSyncProvider } from "@/features/brokerage-sync/providers/robinhood";
import { assertBrokerageSyncEnabled } from "@/features/brokerage-sync/server/kill-switch";
import type { BrokerageConnectionRef } from "@/shared/contracts/brokerage-sync-provider";

export interface SyncResult {
  success: boolean;
  error?: string;
  rowsSynced?: number;
}

/**
 * Manual "sync now" trigger, called directly from a Server Action rather
 * than an Inngest job for this first pass — see
 * docs/phase-0/11-implementation-plan.md Phase 2, which flags moving this
 * to a durable background job as a fast-follow, not a blocker for the
 * connect flow. Every code path here still only ever calls
 * BrokerageSyncProvider's read methods — see
 * docs/phase-0/09-security-model.md §3.3.
 */
export async function syncRobinhoodNow(portfolioId: string): Promise<SyncResult> {
  const user = await requireUser();
  const { workspaceId } = await ensureWorkspaceForUser(user);

  try {
    await assertBrokerageSyncEnabled(workspaceId, user.id);
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Sync is currently disabled." };
  }

  const prisma = forUser(user.id);
  const portfolio = await prisma.portfolio.findUnique({
    where: { id: portfolioId },
    include: { brokerageConnection: true },
  });

  if (!portfolio?.brokerageConnection || portfolio.brokerageConnection.status === "DISCONNECTED") {
    return { success: false, error: "No active Robinhood connection." };
  }

  const connectionRef: BrokerageConnectionRef = {
    connectionId: portfolio.brokerageConnection.id,
    credentialRef: portfolio.brokerageConnection.credentialRef,
  };

  await prismaService.auditLog.create({
    data: { workspaceId, userId: user.id, action: "BROKERAGE_SYNC_RUN", metadata: { portfolioId, status: "started" } },
  });

  try {
    const transactions = await robinhoodBrokerageSyncProvider.listTransactions(
      connectionRef,
      portfolio.brokerageConnection.lastSyncedAt ?? undefined,
    );

    const affectedCompanyIds = new Set<string>();
    let rowsSynced = 0;

    for (const tx of transactions) {
      const company = await getOrResolveCompanyByTicker(tx.ticker);
      if (!company) continue; // an unresolvable ticker skips that row rather than failing the whole sync

      await prisma.transaction.upsert({
        where: { portfolioId_externalId: { portfolioId, externalId: tx.externalId } },
        update: {}, // transactions are immutable once recorded — upsert exists only for idempotent re-sync
        create: {
          portfolioId,
          companyId: company.id,
          type: tx.type,
          quantity: tx.quantity,
          price: tx.price,
          occurredAt: new Date(tx.occurredAt),
          source: "ROBINHOOD_SYNC",
          externalId: tx.externalId,
        },
      });

      affectedCompanyIds.add(company.id);
      rowsSynced++;
    }

    for (const companyId of affectedCompanyIds) {
      await recomputeHolding(prisma, portfolioId, companyId);
    }

    await prisma.brokerageConnection.update({
      where: { portfolioId },
      data: { lastSyncedAt: new Date() },
    });

    await prismaService.auditLog.create({
      data: {
        workspaceId,
        userId: user.id,
        action: "BROKERAGE_SYNC_RUN",
        metadata: { portfolioId, status: "completed", rowsSynced },
      },
    });

    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath("/settings/integrations/robinhood");

    return { success: true, rowsSynced };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed.";

    await prismaService.auditLog.create({
      data: { workspaceId, userId: user.id, action: "BROKERAGE_SYNC_RUN", metadata: { portfolioId, status: "failed", error: message } },
    });

    return { success: false, error: message };
  }
}
