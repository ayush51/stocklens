import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ingestAllSignalSources } from "@/features/signal-convergence/server/ingestion";

/**
 * This app has no background-job/scheduler system (see
 * signal-convergence/server/actions.ts's identical reasoning) — Vercel
 * Cron is the zero-new-dependency, platform-native option, since this app
 * already deploys to Vercel. Configured in vercel.json; Vercel signs
 * every cron request with a Bearer token matching CRON_SECRET.
 *
 * This is the only route handler in the entire app (everything else is
 * Server Components/Actions) — it exists here specifically because Vercel
 * Cron needs an HTTP endpoint to hit on a schedule, which a Server Action
 * can't be.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    logger.warn("signal_convergence_cron_rejected", { reason: "CRON_SECRET not configured" });
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("signal_convergence_cron_rejected", { reason: "invalid or missing auth header" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await ingestAllSignalSources();
    return NextResponse.json({
      insiderStatus: result.insiderRun.status,
      contractsStatus: result.contractsRun.status,
    });
  } catch (error) {
    logger.warn("signal_convergence_cron_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Internal detail deliberately not included in the response — never
    // expose provider internals/stack traces in an API response.
    return NextResponse.json({ error: "Ingestion failed" }, { status: 500 });
  }
}
