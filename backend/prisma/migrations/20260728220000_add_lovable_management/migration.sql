-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "operatorName" TEXT,
    "openingAmount" REAL NOT NULL,
    "closingAmount" REAL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "CashSession_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "CashMovement" ADD COLUMN "cashSessionId" TEXT REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Category_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "document" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "pin" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "PaymentSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PaymentSetting_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OnlineOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "marketId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "customerDocument" TEXT,
    "deliveryType" TEXT NOT NULL DEFAULT 'PICKUP',
    "address" TEXT,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "subtotal" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "deliveryFee" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OnlineOrder_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "OnlineOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" REAL NOT NULL,
    "total" REAL NOT NULL,
    CONSTRAINT "OnlineOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "OnlineOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "CashSession_marketId_idx" ON "CashSession"("marketId");
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");
CREATE INDEX "Category_marketId_idx" ON "Category"("marketId");
CREATE UNIQUE INDEX "Category_marketId_name_key" ON "Category"("marketId", "name");
CREATE INDEX "Customer_marketId_idx" ON "Customer"("marketId");
CREATE INDEX "Employee_marketId_idx" ON "Employee"("marketId");
CREATE INDEX "PaymentSetting_marketId_idx" ON "PaymentSetting"("marketId");
CREATE UNIQUE INDEX "PaymentSetting_marketId_type_key" ON "PaymentSetting"("marketId", "type");
CREATE INDEX "OnlineOrder_marketId_idx" ON "OnlineOrder"("marketId");
CREATE INDEX "OnlineOrder_createdAt_idx" ON "OnlineOrder"("createdAt");
CREATE UNIQUE INDEX "OnlineOrder_marketId_orderNumber_key" ON "OnlineOrder"("marketId", "orderNumber");
CREATE INDEX "OnlineOrderItem_orderId_idx" ON "OnlineOrderItem"("orderId");
