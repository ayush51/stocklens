import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { logger } from "@/lib/logger";
import { secInsiderTransactionsProvider } from "@/features/signal-convergence/providers/sec-insider";
import { usaSpendingContractsProvider } from "@/features/signal-convergence/providers/usaspending";
import {
  AUTO_ACCEPT_CONFIDENCE,
  recordUnresolvedEntity,
  resolveCompanyByName,
} from "@/features/signal-convergence/server/entity-resolution";

/**
 * Companies to ingest for: every Company row already tracked by this app
 * (added via CSV import, Robinhood sync, or manual search) — not a
 * separate "watchlist" concept. This data is global reference data (see
 * the schema migration's doc comment), so ingesting for every tracked
 * company serves every user, matching how FinancialStatement/SecFiling
 * already work.
 */
async function getIngestionTargets(): Promise<{ id: string; name: string; cik: string | null }[]> {
  return prisma.company.findMany({ select: { id: true, name: true, cik: true } });
}

async function startRun(source: "SEC_INSIDER" | "USASPENDING") {
  return prismaService.sourceIngestionRun.create({ data: { source, status: "RUNNING" } });
}

async function recordError(runId: string, recordId: string, errorType: string, message: string) {
  await prismaService.sourceIngestionError.create({ data: { runId, recordId, errorType, message } });
}

async function finishRun(
  runId: string,
  counts: {
    recordsFetched: number;
    recordsInserted: number;
    recordsUpdated: number;
    recordsSkipped: number;
    parsingFailures: number;
    rateLimitFailures: number;
  },
) {
  const status = counts.parsingFailures > 0 || counts.rateLimitFailures > 0 ? "PARTIAL" : "SUCCEEDED";
  return prismaService.sourceIngestionRun.update({
    where: { id: runId },
    data: { ...counts, status, completedAt: new Date() },
  });
}

/**
 * Insider transactions are resolved by construction — each company is
 * ingested by its own CIK, so resolvedCompanyId is always that same
 * company, at full confidence. No entity-resolution review needed here.
 */
export async function ingestInsiderTransactions(opts?: { since?: Date }) {
  const run = await startRun("SEC_INSIDER");
  const targets = (await getIngestionTargets()).filter((c) => c.cik);

  let recordsFetched = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let parsingFailures = 0;
  // A persistent 429 (after the provider's own retry-with-backoff is
  // exhausted) currently folds into parsingFailures rather than a
  // separate counter — both mean "this filing's data is missing," and
  // the provider's own logger.warn calls (insider_filing_fetch_failed,
  // insider_rate_limited_retrying) still distinguish the real cause for
  // debugging even though this run-level summary doesn't split them out.
  const rateLimitFailures = 0;

  for (const company of targets) {
    let records;
    try {
      records = await secInsiderTransactionsProvider.listTransactionsForIssuer(company.cik!, {
        since: opts?.since,
        limit: 50,
      });
    } catch (error) {
      parsingFailures += 1;
      await recordError(
        run.id,
        company.id,
        "provider_error",
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }

    recordsFetched += records.length;
    for (const record of records) {
      try {
        const existing = await prismaService.insiderTransactionEvent.findUnique({
          where: {
            accessionNumber_lineIndex: {
              accessionNumber: record.accessionNumber,
              lineIndex: record.lineIndex,
            },
          },
          select: { id: true },
        });

        await prismaService.insiderTransactionEvent.upsert({
          where: {
            accessionNumber_lineIndex: {
              accessionNumber: record.accessionNumber,
              lineIndex: record.lineIndex,
            },
          },
          update: {
            classification: record.classification,
            isPurchase: record.isPurchase,
            shares: record.shares,
            pricePerShare: record.pricePerShare,
            estimatedTotalValue: record.estimatedTotalValue,
            sharesOwnedAfter: record.sharesOwnedAfter,
            isAmendment: record.isAmendment,
          },
          create: {
            issuerCik: record.issuerCik,
            issuerName: record.issuerName,
            reportingPersonName: record.reportingPersonName,
            reportingPersonTitle: record.reportingPersonTitle,
            relationshipCategory: record.relationshipCategory,
            transactionDate: new Date(record.transactionDate),
            filingDate: new Date(record.filingDate),
            transactionCode: record.transactionCode,
            classification: record.classification,
            isPurchase: record.isPurchase,
            shares: record.shares,
            pricePerShare: record.pricePerShare,
            estimatedTotalValue: record.estimatedTotalValue,
            ownershipType: record.ownershipType,
            sharesOwnedAfter: record.sharesOwnedAfter,
            is10b51Plan: record.is10b51Plan,
            isAmendment: record.isAmendment,
            resolvedCompanyId: company.id,
            accessionNumber: record.accessionNumber,
            lineIndex: record.lineIndex,
            filingUrl: record.filingUrl,
          },
        });

        if (existing) recordsUpdated += 1;
        else recordsInserted += 1;
      } catch (error) {
        parsingFailures += 1;
        await recordError(
          run.id,
          `${record.accessionNumber}#${record.lineIndex}`,
          "write_failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  return finishRun(run.id, {
    recordsFetched,
    recordsInserted,
    recordsUpdated,
    recordsSkipped: 0,
    parsingFailures,
    rateLimitFailures,
  });
}

/**
 * Contracts are searched by company name (USAspending has no CIK
 * concept), so every result runs through real entity resolution — even
 * though we searched using this app's own company name, USAspending's
 * actual recipient name can differ (a subsidiary, a legal-suffix
 * variant), so the match isn't assumed, it's verified the same way any
 * other contract event would be.
 */
export async function ingestGovernmentContracts(opts?: { since?: Date }) {
  const run = await startRun("USASPENDING");
  const targets = await getIngestionTargets();

  let recordsFetched = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let parsingFailures = 0;
  const rateLimitFailures = 0;

  for (const company of targets) {
    let records;
    try {
      records = await usaSpendingContractsProvider.listRecentContractActionsForRecipient(company.name, {
        since: opts?.since,
        limit: 50,
      });
    } catch (error) {
      parsingFailures += 1;
      await recordError(
        run.id,
        company.id,
        "provider_error",
        error instanceof Error ? error.message : String(error),
      );
      continue;
    }

    recordsFetched += records.length;
    for (const record of records) {
      try {
        const resolution = await resolveCompanyByName(record.recipientLegalName);
        const resolvedCompanyId =
          resolution && resolution.confidence >= AUTO_ACCEPT_CONFIDENCE ? resolution.companyId : null;

        // The compound unique key needs a non-null modificationNumber to
        // query against (Prisma's generated type for a nullable field
        // inside a @@unique still requires a concrete value here) — the
        // base/original award action has no real modification number, so
        // "" stands in for that case consistently on read and write.
        const modificationNumberKey = record.modificationNumber ?? "";
        const existing = await prismaService.governmentContractEvent.findUnique({
          where: {
            externalId_modificationNumber: {
              externalId: record.externalId,
              modificationNumber: modificationNumberKey,
            },
          },
          select: { id: true },
        });

        const event = await prismaService.governmentContractEvent.upsert({
          where: {
            externalId_modificationNumber: {
              externalId: record.externalId,
              modificationNumber: modificationNumberKey,
            },
          },
          update: {
            recordType: record.recordType,
            currentAwardAmount: record.currentAwardAmount,
            newlyObligatedAmount: record.newlyObligatedAmount,
            description: record.description,
          },
          create: {
            externalId: record.externalId,
            modificationNumber: modificationNumberKey,
            recipientLegalName: record.recipientLegalName,
            parentRecipientName: record.parentRecipientName,
            awardingAgency: record.awardingAgency,
            description: record.description,
            awardType: record.awardType,
            recordType: record.recordType,
            actionDate: new Date(record.actionDate),
            startDate: record.startDate ? new Date(record.startDate) : null,
            endDate: record.endDate ? new Date(record.endDate) : null,
            currentAwardAmount: record.currentAwardAmount,
            newlyObligatedAmount: record.newlyObligatedAmount,
            potentialAwardAmount: record.potentialAwardAmount,
            resolvedCompanyId,
            resolutionMethod: resolvedCompanyId ? resolution!.method : null,
            resolutionConfidence: resolution?.confidence ?? null,
            sourceUrl: record.sourceUrl,
          },
        });

        if (!resolvedCompanyId) {
          await recordUnresolvedEntity({
            sourceType: "GOVERNMENT_CONTRACT",
            sourceRecordId: event.id,
            rawName: record.recipientLegalName,
            suggestion: resolution,
          });
        }

        if (existing) recordsUpdated += 1;
        else recordsInserted += 1;
      } catch (error) {
        parsingFailures += 1;
        await recordError(
          run.id,
          `${record.externalId}#${record.modificationNumber ?? ""}`,
          "write_failed",
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  return finishRun(run.id, {
    recordsFetched,
    recordsInserted,
    recordsUpdated,
    recordsSkipped: 0,
    parsingFailures,
    rateLimitFailures,
  });
}

export async function ingestAllSignalSources(opts?: { since?: Date }) {
  logger.info("signal_convergence_ingestion_started");
  const [insiderRun, contractsRun] = await Promise.all([
    ingestInsiderTransactions(opts),
    ingestGovernmentContracts(opts),
  ]);
  logger.info("signal_convergence_ingestion_completed", {
    insiderStatus: insiderRun.status,
    contractsStatus: contractsRun.status,
  });
  return { insiderRun, contractsRun };
}
