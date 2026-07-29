import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";
import { parseTemplateProposalContent } from "@/features/company-metrics/lib/template-proposal-schema";

const PROMPT_VERSION = "template-proposal-v1";

export interface ProposeTemplateResult {
  templateId: string;
  itemCount: number;
}

/**
 * Proposes a starting-point KPI template for a company that doesn't have
 * one yet, and saves it immediately with source=AI_PROPOSED — safe to
 * auto-save (unlike a thesis draft) because this exact "AI-proposed,
 * clearly labeled, confirm before relying on it" pattern already exists
 * and is already disclosed in the UI (kpi-list.tsx's banner); this is an
 * on-demand version of the same one-off manual template authoring already
 * done in prisma/seed-metric-templates.ts, not a new kind of claim.
 *
 * Metric keys are namespaced with the ticker (e.g. "nvda_data_center_
 * revenue") since MetricDefinition.key is globally unique and an
 * AI-proposed slug from one company could otherwise collide with an
 * unrelated metric of the same name proposed for a different company.
 */
export async function proposeAndSaveMetricTemplate(
  companyId: string,
  ticker: string,
  companyName: string,
  sector: string | null,
  industry: string | null,
): Promise<ProposeTemplateResult> {
  const existing = await prismaService.companyMetricTemplate.findUnique({ where: { companyId } });
  if (existing) {
    throw new AppError("VALIDATION_ERROR", "This company already has a KPI template.");
  }

  const provider = getAISummaryProvider();
  const result = await provider.proposeMetricTemplate({
    ticker,
    companyName,
    sector,
    industry,
    promptVersion: PROMPT_VERSION,
  });

  const parsed = parseTemplateProposalContent(result.content);
  if (!parsed) {
    throw new AppError("INTERNAL_ERROR", "AI KPI template proposal returned an unexpected format.");
  }

  const tickerPrefix = ticker.toLowerCase();
  const template = await prismaService.companyMetricTemplate.create({
    data: { companyId, name: `${companyName} KPIs`, source: "AI_PROPOSED" },
  });

  let itemCount = 0;
  for (const [index, metric] of parsed.metrics.entries()) {
    const key = `${tickerPrefix}_${metric.keySlug}`;
    const definition = await prismaService.metricDefinition.upsert({
      where: { key },
      update: {},
      create: { key, label: metric.label, description: metric.description, unit: metric.unit },
    });

    await prismaService.companyMetricTemplateItem.create({
      data: {
        templateId: template.id,
        metricDefinitionId: definition.id,
        displayOrder: index,
        whyItMatters: metric.whyItMatters,
        reportedIn: metric.reportedIn,
      },
    });
    itemCount++;
  }

  return { templateId: template.id, itemCount };
}
