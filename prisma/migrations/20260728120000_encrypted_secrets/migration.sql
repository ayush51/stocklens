-- Envelope-encrypted secret storage for brokerage credentials (and any
-- future pending-MFA-challenge state during the Robinhood connect flow).
-- Deliberately NOT granted to app_user at all — not even SELECT. Only
-- service_role_app (BYPASSRLS) can touch this table, via
-- src/lib/crypto/encrypted-secrets.ts. See docs/phase-0/09-security-model.md §3.2.

CREATE TABLE "EncryptedSecret" (
    "id" UUID NOT NULL, -- generated client-side by Prisma, matching every other table's convention (no DB default)
    "ciphertext" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncryptedSecret_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "EncryptedSecret" ENABLE ROW LEVEL SECURITY;

-- No policies at all: with RLS enabled and zero policies, every role except
-- the table owner and BYPASSRLS roles is denied all access by default. No
-- GRANT to app_user either, so even a future policy addition wouldn't
-- accidentally open it up — the privilege has to be granted AND a policy
-- written for app_user to ever see this table.
GRANT SELECT, INSERT, UPDATE, DELETE ON "EncryptedSecret" TO service_role_app;
