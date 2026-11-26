CREATE TABLE "Supplier" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "marketId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "document" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Supplier_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Supplier_marketId_idx" ON "Supplier"("marketId");

CREATE TABLE "Purchase" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "marketId" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "reference" TEXT,
  "source" TEXT NOT NULL DEFAULT 'ROMANEIO',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "total" REAL NOT NULL DEFAULT 0,
  "receivedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Purchase_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Purchase_marketId_createdAt_idx" ON "Purchase"("marketId", "createdAt");

CREATE TABLE "PurchaseItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "purchaseId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitCost" REAL NOT NULL,
  "total" REAL NOT NULL,
  CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");