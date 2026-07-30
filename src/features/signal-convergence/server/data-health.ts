import { prismaService } from "@/lib/db/prisma-service";

export interface SourceHealthRow {
  source: string;
  lastSuccessfulRun: { completedAt: Date; recordsFetched: number; recordsInserted: number } | null;
  lastAttemptedRun: { startedAt: Date; status: string } | null;
  recentErrorCount: number;
  isStale: boolean;
  providerKind: "official" | "manual_import" | "sample_fixture";
}

const STALE_AFTER_HOURS = 48;
const SOURCES: { key: "SEC_INSIDER" | "USASPENDING"; providerKind: "official" }[] = [
  { key: "SEC_INSIDER", providerKind: "official" },
  { key: "USASPENDING", providerKind: "official" },
];

export async function getDataHealthSnapshot(): Promise<SourceHealthRow[]> {
  const rows: SourceHealthRow[] = [];

  for (const { key, providerKind } of SOURCES) {
    const [lastSuccessful, lastAttempted, recentErrorCount] = await Promise.all([
      prismaService.sourceIngestionRun.findFirst({
        where: { source: key, status: { in: ["SUCCEEDED", "PARTIAL"] } },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true, recordsFetched: true, recordsInserted: true },
      }),
      prismaService.sourceIngestionRun.findFirst({
        where: { source: key },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true, status: true },
      }),
      prismaService.sourceIngestionError.count({
        where: { run: { source: key }, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

    const isStale =
      !lastSuccessful?.completedAt ||
      Date.now() - lastSuccessful.completedAt.getTime() > STALE_AFTER_HOURS * 60 * 60 * 1000;

    rows.push({
      source: key,
      lastSuccessfulRun: lastSuccessful?.completedAt
        ? {
            completedAt: lastSuccessful.completedAt,
            recordsFetched: lastSuccessful.recordsFetched,
            recordsInserted: lastSuccessful.recordsInserted,
          }
        : null,
      lastAttemptedRun: lastAttempted
        ? { startedAt: lastAttempted.startedAt, status: lastAttempted.status }
        : null,
      recentErrorCount,
      isStale,
      providerKind,
    });
  }

  // Congressional data has no ingestion-run concept in Phase 1 (manual
  // import only) — reported honestly as its own row rather than folded
  // into the two real automated sources above.
  const congressCount = await prismaService.congressionalTransactionEvent.count();
  const latestCongressImport = await prismaService.congressionalTransactionEvent.findFirst({
    orderBy: { firstSeenAt: "desc" },
    select: { firstSeenAt: true, sourceName: true },
  });

  rows.push({
    source: "CONGRESS",
    lastSuccessfulRun: latestCongressImport
      ? {
          completedAt: latestCongressImport.firstSeenAt,
          recordsFetched: congressCount,
          recordsInserted: congressCount,
        }
      : null,
    lastAttemptedRun: null,
    recentErrorCount: 0,
    isStale: !latestCongressImport,
    providerKind: latestCongressImport?.sourceName === "sample_fixture" ? "sample_fixture" : "manual_import",
  });

  return rows;
}
