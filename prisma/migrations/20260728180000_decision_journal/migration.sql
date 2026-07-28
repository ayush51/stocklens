-- Decision journal — required record-keeping for major portfolio decisions
-- (buy/add/hold/trim/exit/watch), including the pre-add behavioral
-- checklist. Tenant data with a direct workspaceId column, same
-- tenant_isolation pattern as Portfolio/Thesis.

CREATE TYPE "DecisionAction" AS ENUM ('BUY', 'ADD', 'HOLD', 'TRIM', 'EXIT', 'WATCH');
CREATE TYPE "DecisionEmotion" AS ENUM ('CONFIDENT', 'ANXIOUS', 'FOMO', 'REGRET', 'NEUTRAL', 'EXCITED', 'FEARFUL');

CREATE TABLE "DecisionJournalEntry" (
    "id" UUID NOT NULL,
    "workspaceId" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "holdingId" UUID,
    "decisionDate" DATE NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "proposedAmount" DECIMAL(20,4),
    "evidenceSupporting" TEXT,
    "evidenceOpposing" TEXT,
    "currentEmotion" "DecisionEmotion",
    "confidence" "ConvictionLevel",
    "thesisImpact" TEXT,
    "positionSizeImpact" TEXT,
    "taxConsiderationNotes" TEXT,
    "whatWouldChangeDecision" TEXT,
    "wouldBuyIfOwnedNone" BOOLEAN,
    "buyingBecauseThesisImprovedNotPriceDrop" BOOLEAN,
    "belowAllocationCeiling" BOOLEAN,
    "portfolioAdequatelyDiversified" BOOLEAN,
    "newEvidenceForPurchase" TEXT,
    "evidenceThatWouldProveWrong" TEXT,
    "reviewDate" DATE,
    "finalAction" TEXT,
    "outcomeNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecisionJournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DecisionJournalEntry_workspaceId_decisionDate_idx" ON "DecisionJournalEntry"("workspaceId", "decisionDate");
CREATE INDEX "DecisionJournalEntry_companyId_idx" ON "DecisionJournalEntry"("companyId");

ALTER TABLE "DecisionJournalEntry" ADD CONSTRAINT "DecisionJournalEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DecisionJournalEntry" ADD CONSTRAINT "DecisionJournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DecisionJournalEntry" ADD CONSTRAINT "DecisionJournalEntry_holdingId_fkey" FOREIGN KEY ("holdingId") REFERENCES "Holding"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DecisionJournalEntry" ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON "DecisionJournalEntry" TO app_user;

CREATE POLICY tenant_isolation ON "DecisionJournalEntry"
  USING ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()))
  WITH CHECK ("workspaceId" IN (SELECT app_private.current_user_workspace_ids()));
