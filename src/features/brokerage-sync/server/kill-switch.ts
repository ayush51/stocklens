import { env } from "@/lib/env";
import { prismaService } from "@/lib/db/prisma-service";

/**
 * Global kill switch — checked before every brokerage sync attempt, manual
 * or scheduled alike. See docs/phase-0/09-security-model.md §3.3.
 *
 * A blocked attempt writes an AuditLog row rather than failing silently, so
 * "sync stopped working" and "sync was deliberately disabled" are always
 * distinguishable after the fact.
 */
export async function assertBrokerageSyncEnabled(workspaceId: string, userId: string): Promise<void> {
  if (env.BROKERAGE_SYNC_ENABLED) {
    return;
  }

  await prismaService.auditLog.create({
    data: {
      workspaceId,
      userId,
      action: "BROKERAGE_SYNC_BLOCKED_BY_KILL_SWITCH",
    },
  });

  throw new Error("Brokerage sync is currently disabled.");
}
