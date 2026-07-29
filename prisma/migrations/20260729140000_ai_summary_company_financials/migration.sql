-- Adds COMPANY_FINANCIALS as a new AISummary subject type, for plain-English
-- summaries of a company's recent reported financial statements (revenue,
-- net income, EPS trend, etc across the last several periods). Global
-- reference data, same as SEC_FILING/EARNINGS_EVENT — keyed by companyId
-- rather than a single FinancialStatement row since the summary covers
-- several periods together.

ALTER TYPE "AISummarySubjectType" ADD VALUE 'COMPANY_FINANCIALS';

ALTER TABLE "AISummary" ADD COLUMN "companyId" UUID;
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX "AISummary_subjectType_secFilingId_earningsEventId_thesisId__key";
CREATE UNIQUE INDEX "AISummary_subjectType_secFilingId_earningsEventId_thesisId__key" ON "AISummary" ("subjectType", "secFilingId", "earningsEventId", "thesisId", "companyId", "inputHash");
