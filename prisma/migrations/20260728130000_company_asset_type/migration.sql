-- Distinguishes ETFs/funds from operating-company stocks. Needed because
-- SEC EDGAR's ticker->CIK list only covers 10-K filers: ETF positions
-- synced from a brokerage resolve with no CIK and no fundamentals, so the
-- portfolio UI buckets them separately instead of treating a null cik as
-- an error.
CREATE TYPE "CompanyAssetType" AS ENUM ('STOCK', 'ETF');

ALTER TABLE "Company" ADD COLUMN "assetType" "CompanyAssetType" NOT NULL DEFAULT 'STOCK';
