CREATE TABLE "CardFeeRule" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "marketId" TEXT NOT NULL,
 "paymentMethod" TEXT NOT NULL,
 "providerName" TEXT NOT NULL,
 "feeBps" INTEGER NOT NULL,
 "settlementDays" INTEGER NOT NULL DEFAULT 1,
 "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "CardFeeRule_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CardFeeRule_marketId_paymentMethod_key" ON "CardFeeRule"("marketId","paymentMethod");