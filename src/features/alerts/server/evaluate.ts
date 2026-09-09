import { forUser, type ScopedPrismaClient } from "@/lib/db/rls";
import { prismaService } from "@/lib/db/prisma-service";
import { getMarketDataProvider } from "@/features/market-data/server/get-provider";
import type { MarketDataProvider } from "@/shared/contracts/market-data-provider";
import type { AlertRule, Company, Thesis } from "@/generated/prisma/client";

export interface AlertEvaluation {
  ruleId: string;
  type: string;
  ticker: string | null;
  triggered: boolean;
  /** Null when the rule couldn't be evaluated (e.g. no live quote available) — distinct from "checked and not triggered." */
  message: string | null;
}

const EVENT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function evaluateRule(
  rule: AlertRule,
  companyById: Map<string, Company>,
  thesisById: Map<string, Thesis>,
  provider: MarketDataProvider,
): Promise<AlertEvaluation> {
  const company = rule.companyId ? companyById.get(rule.companyId) : undefined;
  const config = rule.config as Record<string, unknown>;

  if (rule.type === "PRICE_ABOVE" || rule.type === "PRICE_BELOW") {
    if (!company) {
      return { ruleId: rule.id, type: rule.type, ticker: null, triggered: false, message: null };
    }
    const quote = await provider.getQuote(company.ticker);
    const threshold = Number(config.threshold);
    if (!quote) {
      return { ruleId: rule.id, type: rule.type, ticker: company.ticker, triggered: false, message: null };
    }
    const price = Number(quote.price);
    const triggered = rule.type === "PRICE_ABOVE" ? price > threshold : price < threshold;
    const direction = rule.type === "PRICE_ABOVE" ? "above" : "below";
    return {
      ruleId: rule.id,
      type: rule.type,
      ticker: company.ticker,
      triggered,
      message: triggered
        ? `${company.ticker} is ${direction} $${threshold} — currently $${price.toFixed(2)}`
        : `${company.ticker} is $${price.toFixed(2)}, not yet ${direction} $${threshold}`,
    };
  }

  if (rule.type === "UPCOMING_EARNINGS") {
    if (!company) {
      return { ruleId: rule.id, type: rule.type, ticker: null, triggered: false, message: null };
    }
    const daysBefore = Number(config.daysBefore);
    const today = new Date().toISOString().slice(0, 10);
    const cutoff = new Date(Date.now() + daysBefore * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const entries = await provider.getEarningsCalendar(company.ticker, today, cutoff);
    const next = entries[0];
    return {
      ruleId: rule.id,
      type: rule.type,
      ticker: company.ticker,
      triggered: !!next,
      message: next
        ? `${company.ticker} reports earnings on ${next.reportDate} (within ${daysBefore} days)`
        : `${company.ticker} has no earnings report scheduled in the next ${daysBefore} days`,
    };
  }

  if (rule.type === "THESIS_STALE") {
    const thesis = rule.thesisId ? thesisById.get(rule.thesisId) : undefined;
    if (!thesis) {
      return {
        ruleId: rule.id,
        type: rule.type,
        ticker: company?.ticker ?? null,
        triggered: false,
        message: null,
      };
    }
    const today = new Date().toISOString().slice(0, 10);
    const isStale = !!thesis.nextReviewDate && thesis.nextReviewDate.toISOString().slice(0, 10) <= today;
    return {
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

  // NEW_FILING or any future type this evaluator doesn't implement yet.
  return {
    ruleId: rule.id,
    type: rule.type,
    ticker: company?.ticker ?? null,
    triggered: false,
    message: null,
  };
}

/**
 * Shared evaluation core for a batch of already-scoped AlertRule rows —
 * used both by the per-user on-demand check (rules already scoped to one
 * workspace via forUser()) and by the cron-triggered run-everything path
 * (rules scoped to nothing, since a cron job has no browser session or
 * single user to scope to). A triggering rule gets a real AlertEvent row
 * (IN_APP, deliveryStatus=SENT — "delivery" for this channel just means
 * "recorded for the user to see"), deduplicated with a 24h cooldown per
 * rule so repeated checks in the same day don't spam duplicate history —
 * that cooldown is what makes it safe for both an impatient user clicking
 * "Check now" repeatedly AND a daily cron to write to the same table
 * without ever double-firing the same real event.
 */
async function runEvaluation(
  prisma: ScopedPrismaClient | typeof prismaService,
  rules: AlertRule[],
): Promise<AlertEvaluation[]> {
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
    const evaluation = await evaluateRule(rule, companyById, thesisById, provider);
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

/**
 * Checks every active alert rule in one workspace against real, live data
 * right now — this is the user-triggered on-demand path, RLS-scoped via
 * forUser() to the requesting user's own workspace.
 */
export async function evaluateAndRecordAlerts(
  userId: string,
  workspaceId: string,
): Promise<AlertEvaluation[]> {
  const prisma = forUser(userId);
  const rules = await prisma.alertRule.findMany({ where: { workspaceId, active: true } });
  return runEvaluation(prisma, rules);
}

export interface AllAlertsEvaluationSummary {
  workspacesChecked: number;
  rulesEvaluated: number;
  triggered: number;
}

/**
 * Cron-triggered path (see src/app/api/cron/alerts/route.ts): checks every
 * active rule across every workspace, not just one user's. Uses
 * prismaService (service role, bypasses RLS) rather than forUser() — a
 * scheduled job has no browser request or single authenticated user to
 * scope a client to, same reasoning already established for
 * syncPortfolioFromMcpSnapshot's service-role write path.
 */
export async function evaluateAndRecordAllAlerts(): Promise<AllAlertsEvaluationSummary> {
  const rules = await prismaService.alertRule.findMany({ where: { active: true } });
  const results = await runEvaluation(prismaService, rules);
  return {
    workspacesChecked: new Set(rules.map((r) => r.workspaceId)).size,
    rulesEvaluated: results.length,
    triggered: results.filter((r) => r.triggered).length,
  };
}
