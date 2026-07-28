import { forUser } from "@/lib/db/rls";
import { computeThesisTrend, type ThesisTrend } from "@/features/thesis-scorecard/lib/thesis-trend";
import type { CriterionStatus } from "@/features/thesis-scorecard/lib/suggest-status";

export interface CriterionEvaluationSummary {
  fiscalYear: number;
  fiscalPeriod: string;
  currentValue: string | null;
  previousValue: string | null;
  status: CriterionStatus;
  explanation: string | null;
  source: string | null;
  overrideReason: string | null;
  isManualOverride: boolean;
  evaluatedAt: Date;
}

export interface CriterionSummary {
  id: string;
  metricLabel: string;
  direction: string;
  ruleType: string;
  greenRule: string;
  watchRule: string;
  redRule: string;
  greenThreshold: string | null;
  watchThreshold: string | null;
  evaluationPeriod: string;
  consecutivePeriodRequirement: number;
  latestEvaluation: CriterionEvaluationSummary | null;
  previousEvaluation: CriterionEvaluationSummary | null;
}

export interface ScorecardSummary {
  criteria: CriterionSummary[];
  trend: ThesisTrend;
}

function toEvaluationSummary(evaluation: {
  fiscalYear: number;
  fiscalPeriod: string;
  currentValue: string | null;
  previousValue: string | null;
  status: string;
  explanation: string | null;
  source: string | null;
  overrideReason: string | null;
  isManualOverride: boolean;
  evaluatedAt: Date;
}): CriterionEvaluationSummary {
  return { ...evaluation, status: evaluation.status as CriterionStatus };
}

/**
 * A thesis's scorecard: every criterion with its latest and previous
 * evaluation (for the trend calculation), plus the aggregated
 * strengthening/unchanged/weakening/insufficient-data signal. Tenant data
 * — scoped through forUser(); RLS enforces that the criteria actually
 * belong to a thesis in the caller's workspace.
 */
export async function getScorecardForThesis(userId: string, thesisId: string): Promise<ScorecardSummary> {
  const prisma = forUser(userId);

  const criteria = await prisma.thesisCriterion.findMany({
    where: { thesisId },
    orderBy: { displayOrder: "asc" },
    include: {
      evaluations: {
        orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
        take: 2,
      },
    },
  });

  const summaries: CriterionSummary[] = criteria.map((criterion) => {
    const [latest, previous] = criterion.evaluations;
    return {
      id: criterion.id,
      metricLabel: criterion.metricLabel,
      direction: criterion.direction,
      ruleType: criterion.ruleType,
      greenRule: criterion.greenRule,
      watchRule: criterion.watchRule,
      redRule: criterion.redRule,
      greenThreshold: criterion.greenThreshold?.toString() ?? null,
      watchThreshold: criterion.watchThreshold?.toString() ?? null,
      evaluationPeriod: criterion.evaluationPeriod,
      consecutivePeriodRequirement: criterion.consecutivePeriodRequirement,
      latestEvaluation: latest ? toEvaluationSummary(latest) : null,
      previousEvaluation: previous ? toEvaluationSummary(previous) : null,
    };
  });

  const trend = computeThesisTrend(
    summaries.map((c) => ({
      previousStatus: c.previousEvaluation?.status ?? null,
      currentStatus: c.latestEvaluation?.status ?? "INSUFFICIENT_DATA",
    })),
  );

  return { criteria: summaries, trend };
}
