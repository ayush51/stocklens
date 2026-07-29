"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth/session";
import { prismaService } from "@/lib/db/prisma-service";
import { AppError } from "@/lib/errors";
import { recordObservationSchema } from "@/features/company-metrics/validation/observation";
import {
  extractKpisForCompany,
  type ExtractKpisResult,
} from "@/features/company-metrics/server/extract-kpis";
import {
  proposeAndSaveMetricTemplate,
  type ProposeTemplateResult,
} from "@/features/company-metrics/server/propose-template";

/**
 * Records (or corrects, via upsert) one reported/manual value for a KPI
 * template item. MetricObservation is global reference data — like Company
 * or FinancialStatement, app_user has no write grant on it, so this goes
 * through the service client even though a signed-in user's action
 * triggered it. requireUser() is the gate ("must be signed in to
 * contribute"), not a workspace-ownership check, since there's no workspace
 * to own here.
 */
export async function recordMetricObservation(input: unknown): Promise<void> {
  await requireUser();

  const parsed = recordObservationSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid input");
  }

  const { templateItemId, ticker, fiscalYear, fiscalPeriod, value, source } = parsed.data;

  const item = await prismaService.companyMetricTemplateItem.findUnique({
    where: { id: templateItemId },
    include: { metricDefinition: true },
  });
  if (!item) {
    throw new AppError("NOT_FOUND", "Metric not found.");
  }

  await prismaService.metricObservation.upsert({
    where: { templateItemId_fiscalYear_fiscalPeriod: { templateItemId, fiscalYear, fiscalPeriod } },
    update: { value, unit: item.metricDefinition.unit, source: source || null, isManualOverride: true },
    create: {
      templateItemId,
      fiscalYear,
      fiscalPeriod,
      value,
      unit: item.metricDefinition.unit,
      source: source || null,
      confidence: "REPORTED",
      isManualOverride: true,
    },
  });

  revalidatePath(`/companies/${ticker}/kpis`);
}

/** User-triggered only — costs real money against a real API key each time. */
export async function extractKpisFromFiling(
  companyId: string,
  ticker: string,
): Promise<ExtractKpisResult | null> {
  await requireUser();
  const result = await extractKpisForCompany(companyId);
  if (result) {
    revalidatePath(`/companies/${ticker}/kpis`);
  }
  return result;
}

/** User-triggered only — costs real money against a real API key. */
export async function proposeKpiTemplate(
  companyId: string,
  ticker: string,
  companyName: string,
  sector: string | null,
  industry: string | null,
): Promise<ProposeTemplateResult> {
  await requireUser();
  const result = await proposeAndSaveMetricTemplate(companyId, ticker, companyName, sector, industry);
  revalidatePath(`/companies/${ticker}/kpis`);
  return result;
}
