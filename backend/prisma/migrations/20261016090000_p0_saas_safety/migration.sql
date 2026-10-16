ALTER TABLE "ProductSale" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ProductSale" ADD COLUMN "idempotencyHash" TEXT;
ALTER TABLE "ProductSale" ADD COLUMN "cancelledAt" DATETIME;
ALTER TABLE "ProductSale" ADD COLUMN "cancellationReason" TEXT;
CREATE UNIQUE INDEX "ProductSale_marketId_idempotencyKey_key" ON "ProductSale"("marketId", "idempotencyKey");

ALTER TABLE "CashSession" ADD COLUMN "registerKey" TEXT NOT NULL DEFAULT 'CAIXA-01';
UPDATE "CashSession"
SET "registerKey" = 'LEGADO-' || substr("id", 1, 24)
WHERE "id" IN (
    SELECT "id" FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "marketId" ORDER BY "openedAt", "id") AS "position"
        FROM "CashSession"
        WHERE "status" = 'OPEN'
    )
    WHERE "position" > 1
);
CREATE UNIQUE INDEX "CashSession_one_open_per_register" ON "CashSession"("marketId", "registerKey") WHERE "status" = 'OPEN';

ALTER TABLE "OnlineOrderItem" ADD COLUMN "productId" TEXT REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "OnlineOrderItem_productId_idx" ON "OnlineOrderItem"("productId");
UPDATE "OnlineOrderItem"
SET "productId" = (
    SELECT p."id"
    FROM "Product" p
    JOIN "OnlineOrder" o ON o."id" = "OnlineOrderItem"."orderId"
    WHERE p."marketId" = o."marketId"
      AND p."name" = "OnlineOrderItem"."productName"
    LIMIT 1
)
WHERE "productId" IS NULL
  AND (
    SELECT COUNT(*)
    FROM "Product" p
    JOIN "OnlineOrder" o ON o."id" = "OnlineOrderItem"."orderId"
    WHERE p."marketId" = o."marketId"
      AND p."name" = "OnlineOrderItem"."productName"
  ) = 1;
