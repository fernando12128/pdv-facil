ALTER TABLE "Product" ADD COLUMN "ncm" TEXT;
ALTER TABLE "Product" ADD COLUMN "cest" TEXT;
ALTER TABLE "Product" ADD COLUMN "cfop" TEXT;
ALTER TABLE "Product" ADD COLUMN "fiscalUnit" TEXT DEFAULT 'UN';
ALTER TABLE "Product" ADD COLUMN "originCode" TEXT DEFAULT '0';
ALTER TABLE "Product" ADD COLUMN "taxSituation" TEXT;

CREATE TABLE "FiscalSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "marketId" TEXT NOT NULL,
  "legalName" TEXT,
  "tradeName" TEXT,
  "cnpj" TEXT,
  "stateRegistration" TEXT,
  "taxRegime" TEXT,
  "stateCode" TEXT,
  "cityName" TEXT,
  "cityIbgeCode" TEXT,
  "postalCode" TEXT,
  "street" TEXT,
  "streetNumber" TEXT,
  "district" TEXT,
  "complementaryAddress" TEXT,
  "fiscalProvider" TEXT NOT NULL DEFAULT 'FOCUS_NFE',
  "environment" TEXT NOT NULL DEFAULT 'HOMOLOGATION',
  "issuanceEnabled" BOOLEAN NOT NULL DEFAULT false,
  "receiptWidth" INTEGER NOT NULL DEFAULT 80,
  "updatedAt" DATETIME NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FiscalSettings_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FiscalSettings_marketId_key" ON "FiscalSettings"("marketId");