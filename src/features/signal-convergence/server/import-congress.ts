"use server";

import { requireUser } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { prismaService } from "@/lib/db/prisma-service";
import {
  parseManualCongressCsv,
  type ManualImportIssue,
} from "@/features/signal-convergence/providers/congress/manual-import";
import {
  AUTO_ACCEPT_CONFIDENCE,
  recordUnresolvedEntity,
  resolveCompanyByName,
} from "@/features/signal-convergence/server/entity-resolution";

export interface ImportCongressResult {
  inserted: number;
  updated: number;
  skipped: number;
  issues: ManualImportIssue[];
}

function daysBetween(earlier: string, later: string): number {
  const ms = new Date(later).getTime() - new Date(earlier).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

/**
 * Real write path for "how to manually import congressional data" (see
 * this feature's README/docs). Any signed-in user can trigger this in
 * this single-workspace personal app — the data itself is global
 * reference data (not tenant-scoped), same footing as
 * GovernmentContractEvent/InsiderTransactionEvent, so writes go through
 * prismaService, not a workspace-scoped client.
 */
export async function importCongressionalCsv(csvText: string): Promise<ImportCongressResult> {
  await requireUser();

  const { records, issues } = parseManualCongressCsv(csvText);
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const record of records) {
    try {
      const existing = await prismaService.congressionalTransactionEvent.findUnique({
        where: { sourceName_externalId: { sourceName: "manual_import", externalId: record.externalId } },
        select: { id: true },
      });

      const resolution = await resolveCompanyByName(record.assetNameDisclosed);
      const resolvedCompanyId =
        resolution && resolution.confidence >= AUTO_ACCEPT_CONFIDENCE ? resolution.companyId : null;

      const event = await prismaService.congressionalTransactionEvent.upsert({
        where: { sourceName_externalId: { sourceName: "manual_import", externalId: record.externalId } },
        update: {
          politicianName: record.politicianName,
          chamber: record.chamber,
          state: record.state,
          party: record.party,
          owner: record.owner,
          assetNameDisclosed: record.assetNameDisclosed,
          resolvedCompanyId,
          resolutionMethod: resolvedCompanyId ? resolution!.method : null,
          resolutionConfidence: resolution?.confidence ?? null,
          transactionType: record.transactionType,
          transactionDate: new Date(record.transactionDate),
          filingDate: new Date(record.filingDate),
          disclosureDelayDays: daysBetween(record.transactionDate, record.filingDate),
          reportedRangeMin: record.reportedRangeMin,
          reportedRangeMax: record.reportedRangeMax,
          estimatedRangeMidpoint:
            record.reportedRangeMin && record.reportedRangeMax
              ? String((Number(record.reportedRangeMin) + Number(record.reportedRangeMax)) / 2)
              : null,
          filingUrl: record.filingUrl,
          sourceName: "manual_import",
          isLiveOfficialSource: false,
        },
        create: {
          politicianName: record.politicianName,
          chamber: record.chamber,
          state: record.state,
          party: record.party,
          owner: record.owner,
          assetNameDisclosed: record.assetNameDisclosed,
          resolvedCompanyId,
          resolutionMethod: resolvedCompanyId ? resolution!.method : null,
          resolutionConfidence: resolution?.confidence ?? null,
          transactionType: record.transactionType,
          transactionDate: new Date(record.transactionDate),
          filingDate: new Date(record.filingDate),
          disclosureDelayDays: daysBetween(record.transactionDate, record.filingDate),
          reportedRangeMin: record.reportedRangeMin,
          reportedRangeMax: record.reportedRangeMax,
          estimatedRangeMidpoint:
            record.reportedRangeMin && record.reportedRangeMax
              ? String((Number(record.reportedRangeMin) + Number(record.reportedRangeMax)) / 2)
              : null,
          filingUrl: record.filingUrl,
          externalId: record.externalId,
          sourceName: "manual_import",
          isLiveOfficialSource: false,
        },
      });

      if (resolution && resolution.confidence < AUTO_ACCEPT_CONFIDENCE) {
        await recordUnresolvedEntity({
          sourceType: "CONGRESSIONAL_TRANSACTION",
          sourceRecordId: event.id,
          rawName: record.assetNameDisclosed,
          suggestion: resolution,
        });
      } else if (!resolution) {
        await recordUnresolvedEntity({
          sourceType: "CONGRESSIONAL_TRANSACTION",
          sourceRecordId: event.id,
          rawName: record.assetNameDisclosed,
          suggestion: null,
        });
      }

      if (existing) updated += 1;
      else inserted += 1;
    } catch {
      skipped += 1;
    }
  }

  revalidatePath("/signal-convergence");
  return { inserted, updated, skipped, issues };
}
