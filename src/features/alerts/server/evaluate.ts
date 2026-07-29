import { forUser } from "@/lib/db/rls";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";

export interface AlertEvaluation {
  ruleId: string;
  type: string;
  ticker: string | null;
  triggered: boolean;
  /** Null when the rule couldn't be evaluated (e.g. no live quote available) — distinct from "checked and not triggered." */
  message: string | null;
}

const EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * Checks every active alert rule in a workspace against real, live data
 * right now — this is an on-demand check the user triggers, NOT a
 * background job (no cron/scheduler infrastructure exists yet in this
 * app), and the UI must say so plainly rather than imply automatic
 * monitoring. A triggering rule gets a real AlertEvent row (IN_APP,
 * deliveryStatus=SENT — "delivery" for this channel just means "recorded
 * for the user to see"), deduplicated with a 24h cooldown per rule so
 * repeated manual checks in the same day don't spam duplicate history.
 */
export async function evaluateAndRecordAlerts(
  userId: string,
  workspaceId: string,
): Promise<AlertEvaluation[]> {
  const prisma = forUser(userId);
  const rules = await prisma.alertRule.findMany({ where: { workspaceId, active: true } });
  if (rules.length === 0) return [];

  const companyIds = [...new Set(rules.map((r) => r.companyId).filter((id): id is string => id !== null))];
  const companies =
    companyIds.length > 0 ? await prisma.company.findMany({ where: { id: { in: companyIds } } }) : [];
  const companyById = new Map(companies.map((c) => [c.id, c]));

  const thesisIds = [...new Set(rules.map((r) => r.thesisId).filter((id): id is string => id !== null))];
  const theses =
    thesisIds.length > 0 ? await prisma.thesis.findMany({ where: { id: { in: thesisIds } } }) : [];
  const thesisById = new Map(theses.map((t) => [t.id, t]));

  const provider = getMarketDataProvider();
  const results: AlertEvaluation[] = [];

  for (const rule of rules) {
    const company = rule.companyId ? companyById.get(rule.companyId) : undefined;
    const config = rule.config as Record<string, unknown>;
    let evaluation: AlertEvaluation;

    if (rule.type === "PRICE_ABOVE" || rule.type === "PRICE_BELOW") {
      if (!company) {
        evaluation = { ruleId: rule.id, type: rule.type, ticker: null, triggered: false, message: null };
      } else {
        const quote = await provider.getQuote(company.ticker);
        const threshold = Number(config.threshold);
        if (!quote) {
          evaluation = {
            ruleId: rule.id,
            type: rule.type,
            ticker: company.ticker,
            triggered: false,
            message: null,
          };
        } else {
          const price = Number(quote.price);
          const triggered = rule.type === "PRICE_ABOVE" ? price > threshold : price < threshold;
          const direction = rule.type === "PRICE_ABOVE" ? "above" : "below";
          evaluation = {
            ruleId: rule.id,
            type: rule.type,
            ticker: company.ticker,
            triggered,
            message: triggered
              ? `${company.ticker} is ${direction} $${threshold} — currently $${price.toFixed(2)}`
              : `${company.ticker} is $${price.toFixed(2)}, not yet ${direction} $${threshold}`,
          };
        }
      }
    } else if (rule.type === "UPCOMING_EARNINGS") {
      if (!company) {
        evaluation = { ruleId: rule.id, type: rule.type, ticker: null, triggered: false, message: null };
      } else {
        const daysBefore = Number(config.daysBefore);
        const today = new Date().toISOString().slice(0, 10);
        const cutoff = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const entries = await provider.getEarningsCalendar(company.ticker, today, cutoff);
        const next = entries[0];
        evaluation = {
          ruleId: rule.id,
          type: rule.type,
          ticker: company.ticker,
          triggered: !!next,
          message: next
            ? `${company.ticker} reports earnings on ${next.reportDate} (within ${daysBefore} days)`
            : `${company.ticker} has no earnings report scheduled in the next ${daysBefore} days`,
        };
      }
    } else if (rule.type === "THESIS_STALE") {
      const thesis = rule.thesisId ? thesisById.get(rule.thesisId) : undefined;
      if (!thesis) {
        evaluation = {
          ruleId: rule.id,
          type: rule.type,
          ticker: company?.ticker ?? null,
          triggered: false,
          message: null,
        };
      } else {
        const today = new Date().toISOString().slice(0, 10);
        const isStale = !!thesis.nextReviewDate && thesis.nextReviewDate.toISOString().slice(0, 10) <= today;
        evaluation = {
          ruleId: rule.id,
          type: rule.type,
          ticker: company?.ticker ?? null,
          triggered: isStale,
          message: thesis.nextReviewDate
            ? isStale
              ? `Thesis for ${company?.ticker ?? "this company"} was due for review on ${thesis.nextReviewDate.toISOString().slice(0, 10)}`
              : `Thesis review isn't due until ${thesis.nextReviewDate.toISOString().slice(0, 10)}`
            : "This thesis has no next-review date set",
        };
      }
    } else {
      // NEW_FILING or any future type this evaluator doesn't implement yet.
      evaluation = {
        ruleId: rule.id,
        type: rule.type,
        ticker: company?.ticker ?? null,
        triggered: false,
        message: null,
      };
    }

    results.push(evaluation);

    if (evaluation.triggered && evaluation.message) {
      const recentEvent = await prisma.alertEvent.findFirst({
        where: { alertRuleId: rule.id, firedAt: { gte: new Date(Date.now() - EVENT_COOLDOWN_MS) } },
      });
      if (!recentEvent) {
        await prisma.alertEvent.create({
          data: {
            alertRuleId: rule.id,
            payload: { message: evaluation.message },
            channel: "IN_APP",
            deliveryStatus: "SENT",
            deliveredAt: new Date(),
          },
        });
      }
    }
  }

  return results;
}
