import { prismaService } from "@/lib/db/prisma-service";
import { secEdgarFilingsProvider } from "@/features/filings/providers/sec-edgar";
import { stripHtmlToText } from "@/features/ai-summaries/lib/strip-html";
import { parseKpiExtractionContent } from "@/features/ai-summaries/lib/kpi-extraction-schema";
import { getAISummaryProvider } from "@/features/ai-summaries/server/get-provider";

const PROMPT_VERSION = "kpi-extraction-v1";
const MAX_CONTENT_CHARS = 400_000;
const FILING_FORM_TYPES = ["10-K", "10-K/A", "10-Q", "10-Q/A"];

export interface ExtractedMetric {
  key: string;
  label: string;
  found: boolean;
  value: string | null;
}

export interface ExtractKpisResult {
  filingFormType: string;
  filingUrl: string;
  fiscalYear: number;
  fiscalPeriod: string;
  extracted: ExtractedMetric[];
  savedCount: number;
}

/**
 * Reads real reported values for a company's curated KPI template out of
 * its most recent 10-K/10-Q, and saves each found value as a
 * MetricObservation. This is the answer to "these are public numbers, why
 * is the field empty" — the template previously only ever stored metric
 * *definitions* (names, why-it-matters notes), never any actual observed
 * value; nothing populated MetricObservation until this.
 *
 * Every saved row gets confidence="UNVERIFIED": the value comes from a real
 * filing (source = the filing URL, so the user can check it in seconds),
 * but the AI's reading of that filing hasn't been human-confirmed, which is
 * exactly what UNVERIFIED means per the MetricConfidence enum's own
 * definition — distinct from a fabricated guess, which this refuses to
 * produce (found=false metrics are skipped, not filled with a made-up
 * value).
 */
export async function extractKpisForCompany(companyId: string): Promise<ExtractKpisResult | null> {
  const template = await prismaService.companyMetricTemplate.findUnique({
    where: { companyId },
    include: { items: { include: { metricDefinition: true } } },
  });
  if (!template || template.items.length === 0) return null;

  const filing = await prismaService.secFiling.findFirst({
    where: { companyId, formType: { in: FILING_FORM_TYPES } },
    orderBy: { filedAt: "desc" },
  });
  if (!filing) return null;

  const latestStatement = await prismaService.financialStatement.findFirst({
    where: { companyId },
    orderBy: [{ fiscalYear: "desc" }, { fiscalPeriod: "desc" }],
  });
  if (!latestStatement) return null;

  const rawHtml = await secEdgarFilingsProvider.getFilingDocumentText(filing.documentUrl);
  const plainText = stripHtmlToText(rawHtml).slice(0, MAX_CONTENT_CHARS);

  const provider = getAISummaryProvider();
  const result = await provider.extractMetrics({
    content: plainText,
    metrics: template.items.map((item) => ({
      key: item.metricDefinition.key,
      label: item.metricDefinition.label,
      description: item.metricDefinition.description,
      unit: item.metricDefinition.unit,
    })),
    promptVersion: PROMPT_VERSION,
  });

  const parsed = parseKpiExtractionContent(result.content);
  if (!parsed) return null;

  const byKey = new Map(parsed.metrics.map((m) => [m.key, m]));
  const extracted: ExtractedMetric[] = [];
  let savedCount = 0;

  for (const item of template.items) {
    const found = byKey.get(item.metricDefinition.key);
    extracted.push({
      key: item.metricDefinition.key,
      label: item.metricDefinition.label,
      found: found?.found ?? false,
      value: found?.value ?? null,
    });

    if (!found?.found || !found.value) continue;

    const existing = await prismaService.metricObservation.findUnique({
      where: {
        templateItemId_fiscalYear_fiscalPeriod: {
          templateItemId: item.id,
          fiscalYear: latestStatement.fiscalYear,
          fiscalPeriod: latestStatement.fiscalPeriod,
        },
      },
    });
    // Never clobber a value the user typed in themselves — theirs is
    // authoritative, an AI re-extraction of the same period isn't.
    if (existing?.isManualOverride) continue;

    await prismaService.metricObservation.upsert({
      where: {
        templateItemId_fiscalYear_fiscalPeriod: {
          templateItemId: item.id,
          fiscalYear: latestStatement.fiscalYear,
          fiscalPeriod: latestStatement.fiscalPeriod,
        },
      },
      update: {
        value: found.value,
        unit: item.metricDefinition.unit,
        source: filing.documentUrl,
        confidence: "UNVERIFIED",
        isManualOverride: false,
      },
      create: {
        templateItemId: item.id,
        fiscalYear: latestStatement.fiscalYear,
        fiscalPeriod: latestStatement.fiscalPeriod,
        value: found.value,
        unit: item.metricDefinition.unit,
        source: filing.documentUrl,
        confidence: "UNVERIFIED",
        isManualOverride: false,
      },
    });
    savedCount++;
  }

  return {
    filingFormType: filing.formType,
    filingUrl: filing.documentUrl,
    fiscalYear: latestStatement.fiscalYear,
    fiscalPeriod: latestStatement.fiscalPeriod,
    extracted,
    savedCount,
  };
}
