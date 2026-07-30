import { logger } from "@/lib/logger";

export interface ProviderCallRecord {
  provider: "finnhub" | "edgar-xbrl" | "yahoo";
  operation: string;
  durationMs: number;
  status: "SUCCESS" | "ERROR";
  errorCategory?: string;
  rateLimited?: boolean;
  usedFallback?: boolean;
}

/**
 * Fire-and-forget: never awaited by a caller, and a write failure here
 * must never break the real request it's logging. This is the per-call
 * event log instructions.md §13 asks for — provider, operation, timing,
 * status, error category, rate-limit state, fallback use — surfaced on
 * /settings/observability via getProviderResilienceSnapshot.
 *
 * Dynamically imports prisma-service rather than importing it at module
 * top-level: prisma-service eagerly validates the full DB env schema on
 * import, and every provider (Finnhub, EDGAR XBRL) calls this on its main
 * request path — a static import would force every unit test of those
 * providers to also satisfy the DB env schema just to log a call, even
 * tests that mock fetch and never touch the database at all.
 */
export function recordProviderCall(record: ProviderCallRecord): void {
  void (async () => {
    try {
      const { prismaService } = await import("@/lib/db/prisma-service");
      await prismaService.providerCallLog.create({
        data: {
          provider: record.provider,
          operation: record.operation,
          durationMs: record.durationMs,
          status: record.status,
          errorCategory: record.errorCategory ?? null,
          rateLimited: record.rateLimited ?? false,
          usedFallback: record.usedFallback ?? false,
        },
      });
    } catch (error) {
      logger.warn("provider_call_log_write_failed", {
        provider: record.provider,
        operation: record.operation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();
}
