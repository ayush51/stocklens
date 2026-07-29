import { prisma } from "@/lib/db/prisma";

export interface MetricObservationSummary {
  fiscalYear: number;
  fiscalPeriod: string;
  value: string;
  unit: string;
  source: string | null;
  confidence: string;
  isManualOverride: boolean;
  recordedAt: Date;
}

export interface MetricTemplateItemSummary {
  id: string;
  key: string;
  label: string;
  description: string | null;
  unit: string;
  whyItMatters: string | null;
  reportedIn: string | null;
  latestObservation: MetricObservationSummary | null;
  history: MetricObservationSummary[];
}

export interface CompanyMetricTemplateSummary {
  id: string;
  name: string;
  source: string;
  items: MetricTemplateItemSummary[];
}

function toSummary(observation: {
  fiscalYear: number;
  fiscalPeriod: string;
  value: string;
  unit: string;
  source: string | null;
  confidence: string;
  isManualOverride: boolean;
  recordedAt: Date;
}): MetricObservationSummary {
  return observation;
}

/**
 * A company's curated KPI template with its latest few recorded
 * observations per metric. Company/MetricDefinition/CompanyMetricTemplate/
 * MetricObservation are all global reference data (see the
 * company_metric_templates migration) — the default RLS-scoped `prisma`
 * client reads them fine with no user claim needed, same as Company itself.
 *
 * Returns null when the company has no template yet — see
 * prisma/seed-metric-templates.ts for current coverage. That's a normal
 * "nothing to show" case, not an error.
 */
export async function getMetricTemplateForCompany(
  companyId: string,
): Promise<CompanyMetricTemplateSummary | null> {
  const template = await prisma.companyMetricTemplate.findUnique({
    where: { companyId },
    include: {
      items: {
        orderBy: { displayOrder: "asc" },
        include: {
          metricDefinition: true,
          observations: {
            orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
            take: 4,
          },
        },
      },
    },
  });

  if (!template) return null;

  return {
    id: template.id,
    name: template.name,
    source: template.source,
    items: template.items.map((item) => {
      const history = item.observations.map(toSummary);
      return {
        id: item.id,
        key: item.metricDefinition.key,
        label: item.metricDefinition.label,
        description: item.metricDefinition.description,
        unit: item.metricDefinition.unit,
        whyItMatters: item.whyItMatters,
        reportedIn: item.reportedIn,
        latestObservation: history[0] ?? null,
        history,
      };
    }),
  };
}
