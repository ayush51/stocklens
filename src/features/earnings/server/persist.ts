import { prismaService } from "@/lib/db/prisma-service";
import { logger } from "@/lib/logger";
import type { UpcomingEarningsRow } from "@/features/earnings/server/queries";

/**
 * Global reference data (same footing as FinancialStatement/Filing — one
 * real-world earnings report is the same for every user, not tenant data),
 * so this writes through prismaService, bypassing RLS.
 *
 * Why this exists at all: verified live (2026-07-29, see
 * EarningsCalendarEntry's doc comment) that Finnhub's free-tier calendar
 * endpoint only ever returns upcoming reports — a date range entirely in
 * the past comes back empty, it does not hand back historical estimates.
 * That means the *only* way to ever compare "what was expected" against
 * "what actually happened" is to capture the estimate now, while the
 * report is still upcoming, so it's still on record once the date passes.
 * Skipped (not fatal) on write failure — this is best-effort caching
 * behind a live view that already works without it.
 */
export async function persistEarningsEvents(rows: UpcomingEarningsRow[]): Promise<void> {
  if (rows.length === 0) return;

  await Promise.all(
    rows.map(async (row) => {
      try {
        await prismaService.earningsEvent.upsert({
          where: {
            companyId_fiscalYear_fiscalPeriod: {
              companyId: row.companyId,
              fiscalYear: row.fiscalYear,
              fiscalPeriod: row.fiscalPeriod as "Q1" | "Q2" | "Q3" | "Q4",
            },
          },
          // Estimates can be revised by analysts before the report date —
          // keep the latest one on update. reportDate can also shift
          // (company reschedules), so that's kept current too.
          update: {
            reportDate: new Date(row.reportDate),
            epsEstimate: row.epsEstimate,
            revenueEstimate: row.revenueEstimate,
          },
          create: {
            companyId: row.companyId,
            fiscalYear: row.fiscalYear,
            fiscalPeriod: row.fiscalPeriod as "Q1" | "Q2" | "Q3" | "Q4",
            reportDate: new Date(row.reportDate),
            epsEstimate: row.epsEstimate,
            revenueEstimate: row.revenueEstimate,
          },
        });
      } catch (error) {
        logger.warn("earnings_event_persist_failed", {
          companyId: row.companyId,
          fiscalYear: row.fiscalYear,
          fiscalPeriod: row.fiscalPeriod,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
