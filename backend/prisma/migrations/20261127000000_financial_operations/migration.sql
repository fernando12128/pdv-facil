-- Suporte a parcelamento de romaneios e conciliação financeira.
DROP INDEX IF EXISTS "FinancialEntry_purchaseId_key";
ALTER TABLE "FinancialEntry" ADD COLUMN "bankTransactionId" TEXT REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD COLUMN "recurrenceId" TEXT REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancialEntry" ADD COLUMN "installmentGroup" TEXT;
ALTER TABLE "FinancialEntry" ADD COLUMN "installmentNumber" INTEGER;
ALTER TABLE "FinancialEntry" ADD COLUMN "installmentCount" INTEGER;
CREATE INDEX "FinancialEntry_marketId_purchaseId_idx" ON "FinancialEntry"("marketId","purchaseId");
CREATE INDEX "FinancialEntry_marketId_recurrenceId_idx" ON "FinancialEntry"("marketId","recurrenceId");
CREATE UNIQUE INDEX "FinancialEntry_bankTransactionId_key" ON "FinancialEntry"("bankTransactionId");

CREATE TABLE "BankAccount" (
 "id" TEXT NOT NULL PRIMARY KEY, "marketId" TEXT NOT NULL,
 "name" TEXT NOT NULL, "bankName" TEXT NOT NULL, "accountType" TEXT NOT NULL DEFAULT 'CHECKING',
 "lastFour" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BankAccount_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BankAccount_marketId_idx" ON "BankAccount"("marketId");

CREATE TABLE "BankTransaction" (
 "id" TEXT NOT NULL PRIMARY KEY, "marketId" TEXT NOT NULL,
 "bankAccountId" TEXT NOT NULL, "externalId" TEXT NOT NULL,
 "date" DATETIME NOT NULL, "description" TEXT NOT NULL, "amountCents" INTEGER NOT NULL,
 "status" TEXT NOT NULL DEFAULT 'UNMATCHED',
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "BankTransaction_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "BankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "BankTransaction_bankAccountId_externalId_key" ON "BankTransaction"("bankAccountId","externalId");
CREATE INDEX "BankTransaction_marketId_date_idx" ON "BankTransaction"("marketId","date");

CREATE TABLE "RecurringRule" (
 "id" TEXT NOT NULL PRIMARY KEY, "marketId" TEXT NOT NULL,
 "type" TEXT NOT NULL, "description" TEXT NOT NULL, "category" TEXT NOT NULL,
 "amountCents" INTEGER NOT NULL, "dayOfMonth" INTEGER NOT NULL, "active" BOOLEAN NOT NULL DEFAULT true,
 "nextDueDate" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "RecurringRule_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "RecurringRule_marketId_nextDueDate_idx" ON "RecurringRule"("marketId","nextDueDate");

CREATE TABLE "FinanceAuditLog" (
 "id" TEXT NOT NULL PRIMARY KEY, "marketId" TEXT NOT NULL,
 "userId" TEXT NOT NULL, "action" TEXT NOT NULL, "targetType" TEXT NOT NULL,
 "targetId" TEXT NOT NULL, "details" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinanceAuditLog_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "FinanceAuditLog_marketId_createdAt_idx" ON "FinanceAuditLog"("marketId","createdAt");
ALTER TABLE "SaleItem" ADD COLUMN "costAtSale" REAL NOT NULL DEFAULT 0;
