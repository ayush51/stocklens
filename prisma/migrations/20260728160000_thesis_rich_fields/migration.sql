-- Expands Thesis/ThesisRevision with the full field set from the product
-- spec (why-mispriced, drivers, risks, assumptions, valuation notes,
-- position-sizing rationale, reasons to add/hold/trim/exit, invalidation
-- conditions, next review date, sources). ThesisRevision mirrors every new
-- Thesis column exactly — it's a full immutable snapshot at each edit, not
-- a diff, so "what changed between versions" stays answerable by comparing
-- two complete rows.
ALTER TABLE "Thesis" ADD COLUMN     "expectedDrivers" TEXT,
ADD COLUMN     "invalidationConditions" TEXT,
ADD COLUMN     "keyAssumptions" TEXT,
ADD COLUMN     "nextReviewDate" DATE,
ADD COLUMN     "positionSizingRationale" TEXT,
ADD COLUMN     "reasonsToAdd" TEXT,
ADD COLUMN     "reasonsToExit" TEXT,
ADD COLUMN     "reasonsToHold" TEXT,
ADD COLUMN     "reasonsToTrim" TEXT,
ADD COLUMN     "risks" TEXT,
ADD COLUMN     "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeHorizon" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "valuationNotes" TEXT,
ADD COLUMN     "whyMispriced" TEXT;

ALTER TABLE "ThesisRevision" ADD COLUMN     "expectedDrivers" TEXT,
ADD COLUMN     "invalidationConditions" TEXT,
ADD COLUMN     "keyAssumptions" TEXT,
ADD COLUMN     "nextReviewDate" DATE,
ADD COLUMN     "positionSizingRationale" TEXT,
ADD COLUMN     "reasonsToAdd" TEXT,
ADD COLUMN     "reasonsToExit" TEXT,
ADD COLUMN     "reasonsToHold" TEXT,
ADD COLUMN     "reasonsToTrim" TEXT,
ADD COLUMN     "risks" TEXT,
ADD COLUMN     "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "timeHorizon" TEXT,
ADD COLUMN     "title" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "valuationNotes" TEXT,
ADD COLUMN     "whyMispriced" TEXT;
