-- Vincula um lançamento financeiro a cada romaneio sem permitir duplicidade.
ALTER TABLE "FinancialEntry" ADD COLUMN "purchaseId" TEXT REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "FinancialEntry_purchaseId_key" ON "FinancialEntry"("purchaseId");

-- Compras já existentes recebem sua conta a pagar; operações futuras fazem isso na mesma transação.
-- O vencimento das compras antigas usa a data do cadastro (ajustável em melhorias futuras).
INSERT INTO "FinancialEntry"
  ("id", "marketId", "type", "description", "category", "amountCents", "dueDate",
   "status", "notes", "createdAt", "updatedAt", "purchaseId")
SELECT lower(hex(randomblob(16))), p."marketId", 'PAYABLE',
       'Compra - ' || s."name" || CASE WHEN p."reference" IS NOT NULL AND p."reference" <> '' THEN ' (' || p."reference" || ')' ELSE '' END,
       'Compras de mercadorias', CAST(ROUND(p."total" * 100) AS INTEGER),
       p."createdAt", 'OPEN', 'Gerado automaticamente a partir do romaneio existente.',
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p."id"
FROM "Purchase" p
INNER JOIN "Supplier" s ON s."id" = p."supplierId" AND s."marketId" = p."marketId"
WHERE p."total" > 0
  AND NOT EXISTS (SELECT 1 FROM "FinancialEntry" f WHERE f."purchaseId" = p."id");