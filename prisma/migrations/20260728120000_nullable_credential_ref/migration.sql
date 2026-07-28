-- credentialRef has no value under the MCP-assisted sync model: the app
-- never authenticates to the brokerage itself, so there is no credential
-- to reference. Nullable rather than dropped, so a future self-service
-- connect flow can populate it without another migration.
ALTER TABLE "BrokerageConnection" ALTER COLUMN "credentialRef" DROP NOT NULL;
