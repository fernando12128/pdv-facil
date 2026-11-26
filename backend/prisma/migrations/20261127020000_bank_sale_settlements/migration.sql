CREATE TABLE "BankTransactionSale" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "marketId" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BankTransactionSale_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankTransactionSale_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "BankTransactionSale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ProductSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankTransactionSale_bankTransactionId_key" ON "BankTransactionSale"("bankTransactionId");
CREATE UNIQUE INDEX "BankTransactionSale_saleId_key" ON "BankTransactionSale"("saleId");
CREATE INDEX "BankTransactionSale_marketId_createdAt_idx" ON "BankTransactionSale"("marketId","createdAt");