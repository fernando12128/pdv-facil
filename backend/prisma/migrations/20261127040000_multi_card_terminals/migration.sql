ALTER TABLE "Market" ADD COLUMN "cardFeeEstimatesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "CardFeeRule" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT true;
DROP INDEX "CardFeeRule_marketId_paymentMethod_key";
CREATE UNIQUE INDEX "CardFeeRule_marketId_paymentMethod_providerName_key" ON "CardFeeRule"("marketId", "paymentMethod", "providerName");
CREATE INDEX "CardFeeRule_marketId_paymentMethod_active_idx" ON "CardFeeRule"("marketId", "paymentMethod", "active");