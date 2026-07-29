-- Expands TransactionType to the full CSV-import vocabulary (dividend
-- reinvestment, deposit/withdrawal/fee/interest cash rows, transfers).
-- Transaction.companyId/quantity/price become nullable to allow cash-only
-- rows (no security involved); `amount` is the authoritative value for
-- those. csvImportJobId links a transaction back to the import that
-- created it, so a rollback can precisely target only that job's rows.
-- CsvImportJob gains filename+checksum (never the raw file — see
-- storagePath's comment) and rowsDuplicate/rolledBackAt for a real
-- import-history/rollback UI. CsvImportJob is currently empty in every
-- environment, so the new NOT NULL columns need no backfill.

ALTER TYPE "TransactionType" ADD VALUE 'DIVIDEND_REINVESTMENT';
ALTER TYPE "TransactionType" ADD VALUE 'DEPOSIT';
ALTER TYPE "TransactionType" ADD VALUE 'WITHDRAWAL';
ALTER TYPE "TransactionType" ADD VALUE 'FEE';
ALTER TYPE "TransactionType" ADD VALUE 'INTEREST';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "TransactionType" ADD VALUE 'TRANSFER_OUT';

ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_companyId_fkey";

ALTER TABLE "CsvImportJob" ADD COLUMN     "checksum" TEXT NOT NULL,
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "rolledBackAt" TIMESTAMP(3),
ADD COLUMN     "rowsDuplicate" INTEGER,
ALTER COLUMN "storagePath" DROP NOT NULL;

ALTER TABLE "Transaction" ADD COLUMN     "amount" DECIMAL(20,4),
ADD COLUMN     "csvImportJobId" UUID,
ALTER COLUMN "companyId" DROP NOT NULL,
ALTER COLUMN "quantity" DROP NOT NULL,
ALTER COLUMN "price" DROP NOT NULL;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_csvImportJobId_fkey" FOREIGN KEY ("csvImportJobId") REFERENCES "CsvImportJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
