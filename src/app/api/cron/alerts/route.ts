import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { evaluateAndRecordAllAlerts } from "@/features/alerts/server/evaluate";

/**
 * Alerts previously only ran when a user clicked "Check now" on /alerts —
 * see evaluate.ts's own comment. Vercel Cron (configured in vercel.json,
 * same CRON_SECRET-gated pattern as
 * src/app/api/cron/signal-convergence/route.ts) gives every workspace's
 * rules at least one automatic daily check, without needing a user to
 * remember to open the app. Still not real-time monitoring — Vercel Cron
 * on this project's plan runs at most once a day, so a threshold crossed
 * and reversed between runs can still be missed. The in-app "Check now"
 * button still exists for anyone who wants a check right now rather than
 * waiting for the next scheduled run.
 */
export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    logger.warn("alerts_cron_rejected", { reason: "CRON_SECRET not configured" });
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.warn("alerts_cron_rejected", { reason: "invalid or missing auth header" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await evaluateAndRecordAllAlerts();
    return NextResponse.json(result);
  } catch (error) {
    logger.warn("alerts_cron_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Internal detail deliberately not included in the response — never
    // expose provider internals/stack traces in an API response.
    return NextResponse.json({ error: "Alert evaluation failed" }, { status: 500 });
  }
}
