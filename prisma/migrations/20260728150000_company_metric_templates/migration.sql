-- Company-specific metric templates/observations — global reference data,
-- same read-only-for-app_user / full-CRUD-for-service_role_app pattern as
-- Company/FinancialStatement (service_role_app already has default
-- privileges on every table, see the rls_and_roles migration's note).

CREATE TYPE "MetricTemplateSource" AS ENUM ('CURATED', 'AI_PROPOSED', 'USER');
CREATE TYPE "MetricConfidence" AS ENUM ('REPORTED', 'ESTIMATED', 'UNVERIFIED');

CREATE TABLE "MetricDefinition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MetricDefinition_key_key" ON "MetricDefinition"("key");

CREATE TABLE "CompanyMetricTemplate" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source" "MetricTemplateSource" NOT NULL DEFAULT 'CURATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyMetricTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyMetricTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanyMetricTemplate_companyId_key" ON "CompanyMetricTemplate"("companyId");

CREATE TABLE "CompanyMetricTemplateItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateId" UUID NOT NULL,
    "metricDefinitionId" UUID NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "whyItMatters" TEXT,
    "reportedIn" TEXT,

    CONSTRAINT "CompanyMetricTemplateItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CompanyMetricTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CompanyMetricTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CompanyMetricTemplateItem_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CompanyMetricTemplateItem_templateId_metricDefinitionId_key" ON "CompanyMetricTemplateItem"("templateId", "metricDefinitionId");

CREATE TABLE "MetricObservation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "templateItemId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" "FiscalPeriod" NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "source" TEXT,
    "confidence" "MetricConfidence" NOT NULL DEFAULT 'REPORTED',
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricObservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MetricObservation_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "CompanyMetricTemplateItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MetricObservation_templateItemId_fiscalYear_fiscalPeriod_key" ON "MetricObservation"("templateItemId", "fiscalYear", "fiscalPeriod");
CREATE INDEX "MetricObservation_templateItemId_idx" ON "MetricObservation"("templateItemId");

ALTER TABLE "MetricDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyMetricTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyMetricTemplateItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MetricObservation" ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON "MetricDefinition", "CompanyMetricTemplate", "CompanyMetricTemplateItem", "MetricObservation" TO app_user;

CREATE POLICY public_read ON "MetricDefinition" FOR SELECT USING (true);
CREATE POLICY public_read ON "CompanyMetricTemplate" FOR SELECT USING (true);
CREATE POLICY public_read ON "CompanyMetricTemplateItem" FOR SELECT USING (true);
CREATE POLICY public_read ON "MetricObservation" FOR SELECT USING (true);
