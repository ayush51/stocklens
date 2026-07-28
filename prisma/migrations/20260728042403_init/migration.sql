-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PortfolioSource" AS ENUM ('MANUAL', 'CSV_IMPORT', 'ROBINHOOD_SYNC');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'SPLIT');

-- CreateEnum
CREATE TYPE "BrokerageConnectionStatus" AS ENUM ('CONNECTED', 'NEEDS_REAUTH', 'DISCONNECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "CsvImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "FiscalPeriod" AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'FY');

-- CreateEnum
CREATE TYPE "ConvictionLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ThesisStatus" AS ENUM ('ACTIVE', 'NEEDS_REVIEW', 'CLOSED');

-- CreateEnum
CREATE TYPE "ThesisRevisionTrigger" AS ENUM ('MANUAL_EDIT', 'EARNINGS_REVIEW', 'FILING_REVIEW');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_ABOVE', 'PRICE_BELOW', 'NEW_FILING', 'UPCOMING_EARNINGS', 'THESIS_STALE');

-- CreateEnum
CREATE TYPE "AlertDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "AlertChannel" AS ENUM ('EMAIL', 'IN_APP');

-- CreateEnum
CREATE TYPE "AISummarySubjectType" AS ENUM ('SEC_FILING', 'EARNINGS_EVENT', 'THESIS');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "WorkspaceRole" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "source" "PortfolioSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "averageCost" DECIMAL(20,4) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(20,6) NOT NULL,
    "price" DECIMAL(20,4) NOT NULL,
    "fees" DECIMAL(20,4),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "source" "PortfolioSource" NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BrokerageConnection" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ROBINHOOD',
    "status" "BrokerageConnectionStatus" NOT NULL DEFAULT 'CONNECTED',
    "credentialRef" TEXT NOT NULL,
    "scopes" TEXT[],
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrokerageConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvImportJob" (
    "id" UUID NOT NULL,
    "portfolioId" UUID NOT NULL,
    "status" "CsvImportStatus" NOT NULL DEFAULT 'PENDING',
    "storagePath" TEXT NOT NULL,
    "columnMapping" JSONB NOT NULL,
    "rowsTotal" INTEGER,
    "rowsSucceeded" INTEGER,
    "rowsFailed" INTEGER,
    "errorDetail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CsvImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" UUID NOT NULL,
    "ticker" TEXT NOT NULL,
    "cik" TEXT,
    "name" TEXT NOT NULL,
    "exchange" TEXT,
    "sector" TEXT,
    "industry" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "asOfDate" DATE NOT NULL,
    "open" DECIMAL(20,4),
    "high" DECIMAL(20,4),
    "low" DECIMAL(20,4),
    "close" DECIMAL(20,4) NOT NULL,
    "volume" BIGINT,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialStatement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" "FiscalPeriod" NOT NULL,
    "revenue" DECIMAL(24,2),
    "netIncome" DECIMAL(24,2),
    "grossProfit" DECIMAL(24,2),
    "eps" DECIMAL(10,4),
    "totalAssets" DECIMAL(24,2),
    "totalLiabilities" DECIMAL(24,2),
    "sourceUrl" TEXT,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecFiling" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "formType" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "periodOfReport" TIMESTAMP(3),
    "documentUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecFiling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningsEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "fiscalPeriod" "FiscalPeriod" NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "epsEstimate" DECIMAL(10,4),
    "epsActual" DECIMAL(10,4),
    "revenueEstimate" DECIMAL(24,2),
    "revenueActual" DECIMAL(24,2),

    CONSTRAINT "EarningsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Thesis" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "holdingId" UUID,
    "summary" TEXT NOT NULL,
    "conviction" "ConvictionLevel" NOT NULL DEFAULT 'MEDIUM',
    "targetPrice" DECIMAL(20,4),
    "status" "ThesisStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Thesis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThesisRevision" (
    "id" UUID NOT NULL,
    "thesisId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "conviction" "ConvictionLevel" NOT NULL,
    "targetPrice" DECIMAL(20,4),
    "trigger" "ThesisRevisionTrigger" NOT NULL DEFAULT 'MANUAL_EDIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThesisRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EarningsReview" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "earningsEventId" UUID NOT NULL,
    "notes" TEXT NOT NULL,
    "affectsThesis" BOOLEAN NOT NULL DEFAULT false,
    "spawnedRevisionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EarningsReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "companyId" UUID,
    "thesisId" UUID,
    "type" "AlertType" NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" UUID NOT NULL,
    "alertRuleId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "channel" "AlertChannel" NOT NULL,
    "deliveryStatus" "AlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AISummary" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "subjectType" "AISummarySubjectType" NOT NULL,
    "secFilingId" UUID,
    "earningsEventId" UUID,
    "thesisId" UUID,
    "inputHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AISummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "Portfolio_workspaceId_idx" ON "Portfolio"("workspaceId");

-- CreateIndex
CREATE INDEX "Holding_companyId_idx" ON "Holding"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Holding_portfolioId_companyId_key" ON "Holding"("portfolioId", "companyId");

-- CreateIndex
CREATE INDEX "Transaction_portfolioId_occurredAt_idx" ON "Transaction"("portfolioId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_portfolioId_externalId_key" ON "Transaction"("portfolioId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "BrokerageConnection_portfolioId_key" ON "BrokerageConnection"("portfolioId");

-- CreateIndex
CREATE INDEX "CsvImportJob_portfolioId_idx" ON "CsvImportJob"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_ticker_key" ON "Company"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cik_key" ON "Company"("cik");

-- CreateIndex
CREATE UNIQUE INDEX "PriceSnapshot_companyId_asOfDate_key" ON "PriceSnapshot"("companyId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialStatement_companyId_fiscalYear_fiscalPeriod_key" ON "FinancialStatement"("companyId", "fiscalYear", "fiscalPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "SecFiling_accessionNumber_key" ON "SecFiling"("accessionNumber");

-- CreateIndex
CREATE INDEX "SecFiling_companyId_filedAt_idx" ON "SecFiling"("companyId", "filedAt");

-- CreateIndex
CREATE INDEX "EarningsEvent_companyId_reportDate_idx" ON "EarningsEvent"("companyId", "reportDate");

-- CreateIndex
CREATE UNIQUE INDEX "EarningsEvent_companyId_fiscalYear_fiscalPeriod_key" ON "EarningsEvent"("companyId", "fiscalYear", "fiscalPeriod");

-- CreateIndex
CREATE UNIQUE INDEX "Thesis_holdingId_key" ON "Thesis"("holdingId");

-- CreateIndex
CREATE INDEX "Thesis_workspaceId_idx" ON "Thesis"("workspaceId");

-- CreateIndex
CREATE INDEX "Thesis_companyId_idx" ON "Thesis"("companyId");

-- CreateIndex
CREATE INDEX "ThesisRevision_thesisId_createdAt_idx" ON "ThesisRevision"("thesisId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EarningsReview_spawnedRevisionId_key" ON "EarningsReview"("spawnedRevisionId");

-- CreateIndex
CREATE INDEX "EarningsReview_workspaceId_idx" ON "EarningsReview"("workspaceId");

-- CreateIndex
CREATE INDEX "AlertRule_workspaceId_idx" ON "AlertRule"("workspaceId");

-- CreateIndex
CREATE INDEX "AlertRule_active_type_idx" ON "AlertRule"("active", "type");

-- CreateIndex
CREATE INDEX "AlertEvent_alertRuleId_firedAt_idx" ON "AlertEvent"("alertRuleId", "firedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AISummary_subjectType_secFilingId_earningsEventId_thesisId__key" ON "AISummary"("subjectType", "secFilingId", "earningsEventId", "thesisId", "inputHash");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Holding" ADD CONSTRAINT "Holding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BrokerageConnection" ADD CONSTRAINT "BrokerageConnection_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CsvImportJob" ADD CONSTRAINT "CsvImportJob_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialStatement" ADD CONSTRAINT "FinancialStatement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecFiling" ADD CONSTRAINT "SecFiling_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsEvent" ADD CONSTRAINT "EarningsEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thesis" ADD CONSTRAINT "Thesis_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thesis" ADD CONSTRAINT "Thesis_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Thesis" ADD CONSTRAINT "Thesis_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThesisRevision" ADD CONSTRAINT "ThesisRevision_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsReview" ADD CONSTRAINT "EarningsReview_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsReview" ADD CONSTRAINT "EarningsReview_earningsEventId_fkey" FOREIGN KEY ("earningsEventId") REFERENCES "EarningsEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EarningsReview" ADD CONSTRAINT "EarningsReview_spawnedRevisionId_fkey" FOREIGN KEY ("spawnedRevisionId") REFERENCES "ThesisRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_alertRuleId_fkey" FOREIGN KEY ("alertRuleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_secFilingId_fkey" FOREIGN KEY ("secFilingId") REFERENCES "SecFiling"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_earningsEventId_fkey" FOREIGN KEY ("earningsEventId") REFERENCES "EarningsEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AISummary" ADD CONSTRAINT "AISummary_thesisId_fkey" FOREIGN KEY ("thesisId") REFERENCES "Thesis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
