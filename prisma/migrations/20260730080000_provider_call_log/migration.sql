-- Provider-call event log (instructions.md §13 provider resilience) —
-- global/operational data, same footing as Company/FinancialStatement:
-- readable by any authenticated user (it's about the app's own health,
-- not anyone's private data), writable only by service_role_app.

CREATE TYPE "ProviderCallStatus" AS ENUM ('SUCCESS', 'ERROR');

CREATE TABLE "ProviderCallLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "provider" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "durationMs" INTEGER NOT NULL,
  "status" "ProviderCallStatus" NOT NULL,
  "errorCategory" TEXT,
  "rateLimited" BOOLEAN NOT NULL DEFAULT false,
  "usedFallback" BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "ProviderCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProviderCallLog_provider_requestedAt_idx" ON "ProviderCallLog"("provider", "requestedAt");

GRANT SELECT ON "ProviderCallLog" TO app_user;

ALTER TABLE "ProviderCallLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read ON "ProviderCallLog" FOR SELECT USING (true);
