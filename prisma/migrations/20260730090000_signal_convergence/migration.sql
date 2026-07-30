-- Signal Convergence feature: government contracts, insider transactions,
-- congressional transactions, and entity resolution. All global reference
-- data (real-world facts, same for every user), same footing as
-- Company/FinancialStatement/EarningsEvent — public-read RLS, writes only
-- through service_role_app (see the GRANT/POLICY block at the end of this
-- file, matching the rls_and_roles migration's pattern exactly).
--
-- PublicCompany/MarketPriceSnapshot from the original feature spec are
-- deliberately NOT new tables here — Company and PriceSnapshot already
-- cover that ground and are reused directly (see schema.prisma's comment
-- on Company's new back-relations).

-- CreateEnum
CREATE TYPE "CompanyAliasType" AS ENUM ('LEGAL_NAME', 'FORMER_NAME', 'DBA', 'GOVERNMENT_CONTRACTOR_NAME', 'MANUAL_ALIAS');

-- CreateEnum
CREATE TYPE "CompanyRelationshipType" AS ENUM ('PARENT_OF', 'SUBSIDIARY_OF');

-- CreateEnum
CREATE TYPE "ResolutionSourceType" AS ENUM ('GOVERNMENT_CONTRACT', 'CONGRESSIONAL_TRANSACTION');

-- CreateEnum
CREATE TYPE "ResolutionReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ContractRecordType" AS ENUM ('NEW_AWARD', 'MODIFICATION', 'DE_OBLIGATION', 'CORRECTION');

-- CreateEnum
CREATE TYPE "InsiderRelationshipCategory" AS ENUM ('DIRECTOR', 'OFFICER', 'TEN_PERCENT_OWNER', 'OTHER');

-- CreateEnum
CREATE TYPE "InsiderTransactionClassification" AS ENUM ('OPEN_MARKET_PURCHASE', 'OPEN_MARKET_SALE', 'OPTION_EXERCISE', 'AWARD_OR_GRANT', 'GIFT', 'TAX_WITHHOLDING', 'AUTOMATIC_OR_PLANNED', 'OTHER');

-- CreateEnum
CREATE TYPE "CongressChamber" AS ENUM ('HOUSE', 'SENATE');

-- CreateEnum
CREATE TYPE "CongressOwner" AS ENUM ('SELF', 'SPOUSE', 'DEPENDENT', 'JOINT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CongressTransactionType" AS ENUM ('PURCHASE', 'SALE', 'EXCHANGE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "IngestionSource" AS ENUM ('SEC_INSIDER', 'USASPENDING', 'CONGRESS_HOUSE', 'CONGRESS_SENATE', 'MARKET_PRICE', 'ENTITY_RESOLUTION', 'SIGNAL_SCORE');

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'PARTIAL');

-- CreateTable
CREATE TABLE "CompanyAlias" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" "CompanyAliasType" NOT NULL,
    "source" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyRelationship" (
    "id" UUID NOT NULL,
    "fromCompanyId" UUID NOT NULL,
    "toCompanyId" UUID NOT NULL,
    "relationshipType" "CompanyRelationshipType" NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityResolutionReview" (
    "id" UUID NOT NULL,
    "sourceType" "ResolutionSourceType" NOT NULL,
    "sourceRecordId" UUID NOT NULL,
    "rawName" TEXT NOT NULL,
    "suggestedCompanyId" UUID,
    "suggestedConfidence" DECIMAL(3,2),
    "status" "ResolutionReviewStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedCompanyId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EntityResolutionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernmentContractEvent" (
    "id" UUID NOT NULL,
    "externalId" TEXT NOT NULL,
    "modificationNumber" TEXT,
    "recipientLegalName" TEXT NOT NULL,
    "parentRecipientName" TEXT,
    "awardingAgency" TEXT NOT NULL,
    "description" TEXT,
    "awardType" TEXT NOT NULL,
    "recordType" "ContractRecordType" NOT NULL,
    "actionDate" DATE NOT NULL,
    "startDate" DATE,
    "endDate" DATE,
    "currentAwardAmount" DECIMAL(20,2),
    "newlyObligatedAmount" DECIMAL(20,2),
    "potentialAwardAmount" DECIMAL(20,2),
    "resolvedCompanyId" UUID,
    "resolutionMethod" TEXT,
    "resolutionConfidence" DECIMAL(3,2),
    "sourceUrl" TEXT,
    "sourceName" TEXT NOT NULL DEFAULT 'usaspending',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "parsingVersion" INTEGER NOT NULL DEFAULT 1,
    "rawPayload" JSONB,

    CONSTRAINT "GovernmentContractEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InsiderTransactionEvent" (
    "id" UUID NOT NULL,
    "issuerCik" TEXT NOT NULL,
    "issuerName" TEXT NOT NULL,
    "reportingPersonName" TEXT NOT NULL,
    "reportingPersonTitle" TEXT,
    "relationshipCategory" "InsiderRelationshipCategory" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "filingDate" DATE NOT NULL,
    "transactionCode" TEXT NOT NULL,
    "classification" "InsiderTransactionClassification" NOT NULL,
    "isPurchase" BOOLEAN,
    "shares" DECIMAL(20,4),
    "pricePerShare" DECIMAL(20,4),
    "estimatedTotalValue" DECIMAL(24,2),
    "ownershipType" TEXT NOT NULL,
    "sharesOwnedAfter" DECIMAL(20,4),
    "is10b51Plan" BOOLEAN NOT NULL DEFAULT false,
    "isAmendment" BOOLEAN NOT NULL DEFAULT false,
    "resolvedCompanyId" UUID,
    "accessionNumber" TEXT NOT NULL,
    "lineIndex" INTEGER NOT NULL,
    "filingUrl" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL DEFAULT 'sec_edgar',
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "parsingVersion" INTEGER NOT NULL DEFAULT 1,
    "rawPayload" JSONB,

    CONSTRAINT "InsiderTransactionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CongressionalTransactionEvent" (
    "id" UUID NOT NULL,
    "politicianName" TEXT NOT NULL,
    "chamber" "CongressChamber" NOT NULL,
    "state" TEXT,
    "party" TEXT,
    "owner" "CongressOwner" NOT NULL DEFAULT 'UNKNOWN',
    "assetNameDisclosed" TEXT NOT NULL,
    "resolvedCompanyId" UUID,
    "resolutionMethod" TEXT,
    "resolutionConfidence" DECIMAL(3,2),
    "transactionType" "CongressTransactionType" NOT NULL,
    "transactionDate" DATE NOT NULL,
    "filingDate" DATE NOT NULL,
    "disclosureDelayDays" INTEGER NOT NULL,
    "reportedRangeMin" DECIMAL(20,2),
    "reportedRangeMax" DECIMAL(20,2),
    "estimatedRangeMidpoint" DECIMAL(20,2),
    "filingUrl" TEXT,
    "externalId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "isLiveOfficialSource" BOOLEAN NOT NULL DEFAULT false,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL,
    "parsingVersion" INTEGER NOT NULL DEFAULT 1,
    "rawPayload" JSONB,

    CONSTRAINT "CongressionalTransactionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIngestionRun" (
    "id" UUID NOT NULL,
    "source" "IngestionSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsFetched" INTEGER NOT NULL DEFAULT 0,
    "recordsInserted" INTEGER NOT NULL DEFAULT 0,
    "recordsUpdated" INTEGER NOT NULL DEFAULT 0,
    "recordsSkipped" INTEGER NOT NULL DEFAULT 0,
    "parsingFailures" INTEGER NOT NULL DEFAULT 0,
    "rateLimitFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessfulCursor" TEXT,
    "errorSummary" TEXT,

    CONSTRAINT "SourceIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceIngestionError" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "recordId" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceIngestionError_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SignalSnapshot" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "windowDays" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalScore" INTEGER NOT NULL,
    "insiderScore" INTEGER NOT NULL,
    "governmentContractScore" INTEGER NOT NULL,
    "congressScore" INTEGER NOT NULL,
    "convergenceBonus" INTEGER NOT NULL,
    "confidence" DECIMAL(3,2) NOT NULL,
    "categoriesMatched" INTEGER NOT NULL,
    "explanations" TEXT[],

    CONSTRAINT "SignalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyAlias_alias_idx" ON "CompanyAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAlias_companyId_alias_aliasType_key" ON "CompanyAlias"("companyId", "alias", "aliasType");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyRelationship_fromCompanyId_toCompanyId_relationshipT_key" ON "CompanyRelationship"("fromCompanyId", "toCompanyId", "relationshipType");

-- CreateIndex
CREATE INDEX "EntityResolutionReview_status_idx" ON "EntityResolutionReview"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EntityResolutionReview_sourceType_sourceRecordId_key" ON "EntityResolutionReview"("sourceType", "sourceRecordId");

-- CreateIndex
CREATE INDEX "GovernmentContractEvent_resolvedCompanyId_actionDate_idx" ON "GovernmentContractEvent"("resolvedCompanyId", "actionDate");

-- CreateIndex
CREATE INDEX "GovernmentContractEvent_actionDate_idx" ON "GovernmentContractEvent"("actionDate");

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentContractEvent_externalId_modificationNumber_key" ON "GovernmentContractEvent"("externalId", "modificationNumber");

-- CreateIndex
CREATE INDEX "InsiderTransactionEvent_resolvedCompanyId_transactionDate_idx" ON "InsiderTransactionEvent"("resolvedCompanyId", "transactionDate");

-- CreateIndex
CREATE INDEX "InsiderTransactionEvent_issuerCik_transactionDate_idx" ON "InsiderTransactionEvent"("issuerCik", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "InsiderTransactionEvent_accessionNumber_lineIndex_key" ON "InsiderTransactionEvent"("accessionNumber", "lineIndex");

-- CreateIndex
CREATE INDEX "CongressionalTransactionEvent_resolvedCompanyId_transaction_idx" ON "CongressionalTransactionEvent"("resolvedCompanyId", "transactionDate");

-- CreateIndex
CREATE UNIQUE INDEX "CongressionalTransactionEvent_sourceName_externalId_key" ON "CongressionalTransactionEvent"("sourceName", "externalId");

-- CreateIndex
CREATE INDEX "SourceIngestionRun_source_startedAt_idx" ON "SourceIngestionRun"("source", "startedAt");

-- CreateIndex
CREATE INDEX "SourceIngestionError_runId_idx" ON "SourceIngestionError"("runId");

-- CreateIndex
CREATE INDEX "SignalSnapshot_companyId_windowDays_computedAt_idx" ON "SignalSnapshot"("companyId", "windowDays", "computedAt");

-- CreateIndex
CREATE INDEX "SignalSnapshot_windowDays_totalScore_idx" ON "SignalSnapshot"("windowDays", "totalScore");

-- AddForeignKey
ALTER TABLE "CompanyAlias" ADD CONSTRAINT "CompanyAlias_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_fromCompanyId_fkey" FOREIGN KEY ("fromCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyRelationship" ADD CONSTRAINT "CompanyRelationship_toCompanyId_fkey" FOREIGN KEY ("toCompanyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityResolutionReview" ADD CONSTRAINT "EntityResolutionReview_suggestedCompanyId_fkey" FOREIGN KEY ("suggestedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityResolutionReview" ADD CONSTRAINT "EntityResolutionReview_resolvedCompanyId_fkey" FOREIGN KEY ("resolvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernmentContractEvent" ADD CONSTRAINT "GovernmentContractEvent_resolvedCompanyId_fkey" FOREIGN KEY ("resolvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsiderTransactionEvent" ADD CONSTRAINT "InsiderTransactionEvent_resolvedCompanyId_fkey" FOREIGN KEY ("resolvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CongressionalTransactionEvent" ADD CONSTRAINT "CongressionalTransactionEvent_resolvedCompanyId_fkey" FOREIGN KEY ("resolvedCompanyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceIngestionError" ADD CONSTRAINT "SourceIngestionError_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SourceIngestionRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SignalSnapshot" ADD CONSTRAINT "SignalSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────
-- Grants and RLS — public_read for app_user, writes via service_role_app
-- only (service_role_app already gets INSERT/UPDATE/DELETE on every new
-- table automatically via ALTER DEFAULT PRIVILEGES set up in the
-- rls_and_roles migration).
-- ─────────────────────────────────────────────────────────────
GRANT SELECT ON
  "CompanyAlias",
  "CompanyRelationship",
  "EntityResolutionReview",
  "GovernmentContractEvent",
  "InsiderTransactionEvent",
  "CongressionalTransactionEvent",
  "SourceIngestionRun",
  "SourceIngestionError",
  "SignalSnapshot"
TO app_user;

ALTER TABLE "CompanyAlias" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyRelationship" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EntityResolutionReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernmentContractEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InsiderTransactionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CongressionalTransactionEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceIngestionRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SourceIngestionError" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SignalSnapshot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read ON "CompanyAlias" FOR SELECT USING (true);
CREATE POLICY public_read ON "CompanyRelationship" FOR SELECT USING (true);
CREATE POLICY public_read ON "EntityResolutionReview" FOR SELECT USING (true);
CREATE POLICY public_read ON "GovernmentContractEvent" FOR SELECT USING (true);
CREATE POLICY public_read ON "InsiderTransactionEvent" FOR SELECT USING (true);
CREATE POLICY public_read ON "CongressionalTransactionEvent" FOR SELECT USING (true);
CREATE POLICY public_read ON "SourceIngestionRun" FOR SELECT USING (true);
CREATE POLICY public_read ON "SourceIngestionError" FOR SELECT USING (true);
CREATE POLICY public_read ON "SignalSnapshot" FOR SELECT USING (true);
