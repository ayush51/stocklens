"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { ingestAllSignalSources } from "@/features/signal-convergence/server/ingestion";

/**
 * On-demand ingestion trigger — this app has no background-job/scheduler
 * system (see CheckNowButton's identical reasoning for alerts), so this
 * is the same pattern: a real, authenticated, user-triggered run against
 * live data. Vercel Cron (see src/app/api/cron/signal-convergence/route.ts)
 * calls the same ingestAllSignalSources function on a schedule — this
 * button and the cron job are two triggers for one real code path, not
 * two different implementations.
 */
export async function triggerManualSignalRefresh() {
  await requireUser();
  const result = await ingestAllSignalSources();
  revalidatePath("/signal-convergence");
  return result;
}
