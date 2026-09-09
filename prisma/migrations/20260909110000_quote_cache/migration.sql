-- Global, ticker-keyed cache of the last live quote fetched from
-- getMarketDataProvider() — global reference data, same footing as
-- Company/PriceSnapshot/ProviderCallLog: readable by any authenticated
-- user, writable only by service_role_app.

CREATE TABLE "QuoteCache" (
  "ticker" TEXT NOT NULL,
  "price" DECIMAL(20,4) NOT NULL,
  "previousClose" DECIMAL(20,4),
  "currency" TEXT NOT NULL,
  "marketTimestamp" TIMESTAMP(3) NOT NULL,
  "retrievedAt" TIMESTAMP(3) NOT NULL,
  "isDelayed" BOOLEAN NOT NULL,
  "source" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "QuoteCache_pkey" PRIMARY KEY ("ticker")
);

GRANT SELECT ON "QuoteCache" TO app_user;

ALTER TABLE "QuoteCache" ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_read ON "QuoteCache" FOR SELECT USING (true);
