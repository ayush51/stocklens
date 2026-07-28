-- Thesis scorecard: configurable Green/Watch/Red criteria. Tenant data
-- (scoped via Thesis -> Workspace), unlike the company-metric-template
-- tables which are global reference data — a criterion's threshold
-- judgment calls belong to one workspace's thesis.

CREATE TYPE "CriterionDirection" AS ENUM ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER');
CREATE TYPE "CriterionRuleType" AS ENUM ('NUMERIC_THRESHOLD', 'PERCENT_GROWTH_THRESHOLD', 'SEQUENTIAL_CHANGE', 'YEAR_OVER_YEAR_CHANGE', 'CONSECUTIVE_DETERIORATION', 'BOOLEAN_EVENT', 'QUALITATIVE_MANUAL');
CREATE TYPE "CriterionStatus" AS ENUM ('GREEN', 'WATCH', 'RED', 'INSUFFICIENT_DATA');

CREATE TABLE "ThesisCriterion" (
    "id" UUID NOT NULL,
    "thesisId" UUID NOT NULL,
    "metricLabel" TEXT NOT NULL,
    "direction" "CriterionDirection" NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "ruleType" "CriterionRuleType" NOT NULL,
    "greenRule" TEXT NOT NULL,
    "watchRule" TEXT NOT NULL,
    "redRule" TEXT NOT NULL,
    "greenThreshold" DECIMAL(20,4),
    "watchThreshold" DECIMAL(20,4),
    "evaluationPeriod" TEXT NOT NULL DEFAULT 'Quarterly',
    "consecutivePeriodRequirement" INTEGER NOT NULL DEFAULT 1,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThesisCriterion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ThesisEvaluation" (
    "id" UUID NOT NULL,
    "criterionId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" "FiscalPeriod" NOT NULL,
    "currentValue" TEXT,
    "previousValue" TEXT,
    "status" "CriterionStatus" NOT NULL DEFAULT 'INSUFFICIENT_DATA',
    "explanation" TEXT,
    "source" TEXT,
    "overrideReason" TEXT,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThesisEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ThesisCriterion_thesisId_idx" ON "ThesisCriterion"("thesisId");
CREATE INDEX "ThesisEvaluation_criterionId_fiscalYear_fiscalPeriod_idx" ON "ThesisEvaluation"("criterionId", "fiscalYear", "fiscalPeriod");
CREATE UNIQUE INDEX "ThesisEvaluation_criterionId_fiscalYear_fiscalPeriod_key" ON "ThesisEvaluation"("criterionId", "fiscalYear", "fiscalPeriod");

ALTER TABLE "ThesisCriterion" ADD CONSTRAINT "ThesisCriterion_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ThesisEvaluation" ADD CONSTRAINT "ThesisEvaluation_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ThesisCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ThesisCriterion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ThesisEvaluation" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON "ThesisCriterion", "ThesisEvaluation" TO app_user;

CREATE POLICY tenant_isolation ON "ThesisCriterion"
  USING (EXISTS (SELECT 1 FROM "Thesis" t WHERE t.id = "thesisId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "Thesis" t WHERE t.id = "thesisId"));

CREATE POLICY tenant_isolation ON "ThesisEvaluation"
  USING (EXISTS (SELECT 1 FROM "ThesisCriterion" c WHERE c.id = "criterionId"))
  WITH CHECK (EXISTS (SELECT 1 FROM "ThesisCriterion" c WHERE c.id = "criterionId"));
