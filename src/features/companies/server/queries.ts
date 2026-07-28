import { prisma } from "@/lib/db/prisma";
import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";
import { resolveTickerViaEdgar } from "@/features/companies/server/edgar-tickers";
import { normalizeTicker } from "@/features/companies/lib/normalize-ticker";

export { normalizeTicker };

/**
 * Every other feature that references a ticker goes through this — never
 * resolve/create a Company independently elsewhere. See
 * docs/phase-0/03-folder-structure.md rule #2.
 *
 * Returns null (not a thrown error) when the ticker can't be resolved at
 * all — that's a normal "this ticker doesn't exist" outcome the caller
 * should render as a not-found state, not an exceptional one.
 */
export async function getOrResolveCompanyByTicker(rawTicker: string) {
  const ticker = normalizeTicker(rawTicker);
  if (!ticker) {
    throw new AppError("VALIDATION_ERROR", "A ticker is required.");
  }

  // Company has an open SELECT policy (global reference data) — the
  // default RLS-scoped client reads it fine with no user claim needed.
  const existing = await prisma.company.findUnique({ where: { ticker } });
  if (existing) {
    return existing;
  }

  const resolved = await resolveTickerViaEdgar(ticker);
  if (!resolved) {
    return null;
  }

  // app_user has no INSERT grant on Company by design — it's global
  // reference data, not tenant data. Creating it here, even though
  // triggered by a user's search, is "the system enriching shared
  // reference data," so it goes through the service client. See
  // docs/phase-0/09-security-model.md §2-3. upsert (not create) to stay
  // safe if two requests resolve the same new ticker concurrently.
  return prismaService.company.upsert({
    where: { ticker: resolved.ticker },
    update: {},
    create: {
      ticker: resolved.ticker,
      cik: resolved.cik,
      name: resolved.name,
    },
  });
}
