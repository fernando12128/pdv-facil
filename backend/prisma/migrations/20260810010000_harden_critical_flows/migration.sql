-- Preserve the newest open cash session per market before enforcing the invariant.
UPDATE "CashSession"
SET
  "status" = 'CLOSED',
  "closedAt" = COALESCE("closedAt", CURRENT_TIMESTAMP),
  "closingStatus" = COALESCE("closingStatus", 'Encerrado durante correção de sessões duplicadas')
WHERE "status" = 'OPEN'
  AND "id" NOT IN (
    SELECT "id"
    FROM (
      SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "marketId"
        ORDER BY "openedAt" DESC, "id" DESC
      ) AS row_number
      FROM "CashSession"
      WHERE "status" = 'OPEN'
    ) ranked
    WHERE row_number = 1
  );

ALTER TABLE "CashSession" ADD COLUMN "openMarketId" TEXT;
UPDATE "CashSession"
SET "openMarketId" = "marketId"
WHERE "status" = 'OPEN';
CREATE UNIQUE INDEX "CashSession_openMarketId_key" ON "CashSession"("openMarketId");

-- Keep the oldest product identifier and clear only conflicting optional identifiers.
UPDATE "Product"
SET "sku" = NULL
WHERE "sku" IS NOT NULL
  AND "id" NOT IN (
    SELECT "id" FROM (
      SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "marketId", "sku" ORDER BY "createdAt" ASC, "id" ASC
      ) AS row_number
      FROM "Product" WHERE "sku" IS NOT NULL
    ) ranked WHERE row_number = 1
  );
UPDATE "Product"
SET "barcode" = NULL
WHERE "barcode" IS NOT NULL
  AND "id" NOT IN (
    SELECT "id" FROM (
      SELECT "id", ROW_NUMBER() OVER (
        PARTITION BY "marketId", "barcode" ORDER BY "createdAt" ASC, "id" ASC
      ) AS row_number
      FROM "Product" WHERE "barcode" IS NOT NULL
    ) ranked WHERE row_number = 1
  );
CREATE UNIQUE INDEX "Product_marketId_sku_key" ON "Product"("marketId", "sku");
CREATE UNIQUE INDEX "Product_marketId_barcode_key" ON "Product"("marketId", "barcode");

ALTER TABLE "OnlineOrderItem" ADD COLUMN "productId" TEXT;
UPDATE "OnlineOrderItem"
SET "productId" = (
  SELECT MIN("Product"."id")
  FROM "OnlineOrder"
  JOIN "Product" ON "Product"."marketId" = "OnlineOrder"."marketId"
  WHERE "OnlineOrder"."id" = "OnlineOrderItem"."orderId"
    AND "Product"."name" = "OnlineOrderItem"."productName"
);

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OnlineOrderItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" REAL NOT NULL,
  "total" REAL NOT NULL,
  CONSTRAINT "OnlineOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OnlineOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OnlineOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_OnlineOrderItem" ("id", "orderId", "productId", "productName", "quantity", "unitPrice", "total")
SELECT "id", "orderId", "productId", "productName", "quantity", "unitPrice", "total"
FROM "OnlineOrderItem";
DROP TABLE "OnlineOrderItem";
ALTER TABLE "new_OnlineOrderItem" RENAME TO "OnlineOrderItem";
CREATE INDEX "OnlineOrderItem_orderId_idx" ON "OnlineOrderItem"("orderId");
CREATE INDEX "OnlineOrderItem_productId_idx" ON "OnlineOrderItem"("productId");
PRAGMA foreign_keys=ON;
