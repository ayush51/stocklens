-- Cumulative realized P&L per holding, re-derived from full transaction
-- history by computeHoldingAggregate whenever a holding is recomputed.
ALTER TABLE "Holding" ADD COLUMN "realizedGainLoss" DECIMAL(20,4) NOT NULL DEFAULT 0;
