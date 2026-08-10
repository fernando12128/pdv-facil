ALTER TABLE "CashSession" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "CashClosingCorrection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "cashSessionId" TEXT NOT NULL,
    "authorizedManagerId" TEXT,
    "authorizedManagerName" TEXT NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "previousClosingAmount" REAL NOT NULL,
    "correctedClosingAmount" REAL NOT NULL,
    "previousDifference" REAL NOT NULL,
    "correctedDifference" REAL NOT NULL,
    "previousClosingStatus" TEXT,
    "correctedClosingStatus" TEXT NOT NULL,
    "previousPaymentSummary" JSONB NOT NULL,
    "correctedPaymentSummary" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashClosingCorrection_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashClosingCorrection_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashClosingCorrection_authorizedManagerId_fkey" FOREIGN KEY ("authorizedManagerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "CashClosingCorrection_marketId_idx" ON "CashClosingCorrection"("marketId");
CREATE INDEX "CashClosingCorrection_cashSessionId_createdAt_idx" ON "CashClosingCorrection"("cashSessionId", "createdAt");
CREATE INDEX "CashClosingCorrection_authorizedManagerId_idx" ON "CashClosingCorrection"("authorizedManagerId");
