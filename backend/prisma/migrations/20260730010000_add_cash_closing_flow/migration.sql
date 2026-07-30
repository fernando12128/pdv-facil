PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ProductSale" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "customerName" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "subtotal" REAL NOT NULL,
    "total" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductSale_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ProductSale_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_ProductSale" (
    "id", "marketId", "userId", "customerName", "paymentMethod",
    "discount", "subtotal", "total", "status", "createdAt", "updatedAt"
)
SELECT
    "id", "marketId", "userId", "customerName", "paymentMethod",
    "discount", "subtotal", "total", "status", "createdAt", "updatedAt"
FROM "ProductSale";

DROP TABLE "ProductSale";
ALTER TABLE "new_ProductSale" RENAME TO "ProductSale";
CREATE INDEX "ProductSale_marketId_idx" ON "ProductSale"("marketId");
CREATE INDEX "ProductSale_cashSessionId_idx" ON "ProductSale"("cashSessionId");
CREATE INDEX "ProductSale_createdAt_idx" ON "ProductSale"("createdAt");

ALTER TABLE "CashSession" ADD COLUMN "expectedCash" REAL;
ALTER TABLE "CashSession" ADD COLUMN "difference" REAL;
ALTER TABLE "CashSession" ADD COLUMN "closingCode" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "closingStatus" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "grossSales" REAL;
ALTER TABLE "CashSession" ADD COLUMN "discounts" REAL;
ALTER TABLE "CashSession" ADD COLUMN "netSales" REAL;
ALTER TABLE "CashSession" ADD COLUMN "discrepancyReason" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "discrepancyNote" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "actionTaken" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "finalNote" TEXT;
ALTER TABLE "CashSession" ADD COLUMN "countHistory" JSONB;
ALTER TABLE "CashSession" ADD COLUMN "paymentSummary" JSONB;

CREATE UNIQUE INDEX "CashSession_closingCode_key" ON "CashSession"("closingCode");

PRAGMA foreign_keys=ON;
