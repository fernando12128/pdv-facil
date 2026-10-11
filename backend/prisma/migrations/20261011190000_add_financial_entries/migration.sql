CREATE TABLE "FinancialEntry" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "marketId" TEXT NOT NULL,
 "type" TEXT NOT NULL,
 "description" TEXT NOT NULL,
 "category" TEXT NOT NULL,
 "amountCents" INTEGER NOT NULL,
 "dueDate" DATETIME NOT NULL,
 "settledAt" DATETIME,
 "status" TEXT NOT NULL DEFAULT 'OPEN',
 "notes" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL,
 CONSTRAINT "FinancialEntry_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinancialEntry_marketId_dueDate_idx" ON "FinancialEntry"("marketId", "dueDate");
CREATE INDEX "FinancialEntry_marketId_status_idx" ON "FinancialEntry"("marketId", "status");
