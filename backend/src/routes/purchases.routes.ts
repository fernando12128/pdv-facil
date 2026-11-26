import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/authMiddleware";

export const purchasesRoutes = Router();
purchasesRoutes.use(authMiddleware);

function canManage(req: AuthenticatedRequest) {
  return ["OWNER", "MANAGER", "STOCK"].includes(req.user?.role || "");
}
function money(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) &&
    value >= 0 && Number.isSafeInteger(Math.round(value * 100)) &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}
function amount(value: number) {
  return Math.round(value * 100) / 100;
}

purchasesRoutes.get("/suppliers", async (req: AuthenticatedRequest, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      where: { marketId: req.user!.marketId },
      orderBy: { name: "asc" }
    });
    return res.json({ suppliers });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao listar fornecedores." });
  }
});

purchasesRoutes.post("/suppliers", async (req: AuthenticatedRequest, res) => {
  if (!canManage(req)) return res.status(403).json({ message: "Sem permissão." });
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name || name.length > 160) return res.status(400).json({ message: "Nome do fornecedor inválido." });
  try {
    const supplier = await prisma.supplier.create({
      data: {
        marketId: req.user!.marketId,
        name,
        document: typeof req.body.document === "string" ? req.body.document.trim().slice(0, 30) || null : null,
        phone: typeof req.body.phone === "string" ? req.body.phone.trim().slice(0, 30) || null : null,
        email: typeof req.body.email === "string" ? req.body.email.trim().slice(0, 160) || null : null
      }
    });
    return res.status(201).json({ supplier });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao cadastrar fornecedor." });
  }
});

purchasesRoutes.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      where: { marketId: req.user!.marketId },
      include: {
        supplier: { select: { id: true, name: true } },
        items: { include: { product: { select: { name: true, sku: true } } } }
      },
      orderBy: { createdAt: "desc" }
    });
    return res.json({ purchases });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao listar compras." });
  }
});

purchasesRoutes.post("/", async (req: AuthenticatedRequest, res) => {
  if (!canManage(req)) return res.status(403).json({ message: "Sem permissão." });
  const marketId = req.user!.marketId;
  const { supplierId, reference, items, dueDate, installmentCount = 1 } = req.body || {};
  if (!Number.isSafeInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) {
    return res.status(400).json({ message: "Quantidade de parcelas deve estar entre 1 e 36." });
  }
  const payableDate = dueDate === undefined || dueDate === null || dueDate === ""
    ? new Date().toISOString().slice(0, 10) : String(dueDate);
  const payableAsDate = new Date(`${payableDate}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payableDate) || Number.isNaN(payableAsDate.getTime()) ||
      payableAsDate.toISOString().slice(0, 10) !== payableDate) {
    return res.status(400).json({ message: "Vencimento da compra inválido." });
  }
  if (typeof supplierId !== "string" || !Array.isArray(items) || items.length < 1 || items.length > 200) {
    return res.status(400).json({ message: "Fornecedor e itens são obrigatórios (máximo 200)." });
  }
  if (reference != null && (typeof reference !== "string" || reference.length > 100)) {
    return res.status(400).json({ message: "Referência inválida." });
  }
  const seen = new Set<string>();
  const normalized: Array<{ productId: string; quantity: number; unitCost: number; total: number }> = [];
  for (const item of items) {
    if (!item || typeof item.productId !== "string" || seen.has(item.productId) ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0 || item.quantity > 100000 ||
      !money(item.unitCost)) {
      return res.status(400).json({ message: "Itens inválidos ou repetidos. Verifique quantidades e custos." });
    }
    seen.add(item.productId);
    normalized.push({
      productId: item.productId,
      quantity: item.quantity,
      unitCost: amount(item.unitCost),
      total: amount(item.quantity * item.unitCost)
    });
    if (!Number.isSafeInteger(Math.round(item.quantity * item.unitCost * 100))) {
      return res.status(400).json({ message: "Valor total do item excede o limite." });
    }
  }
  try {
    const [supplier, count] = await Promise.all([
      prisma.supplier.findFirst({ where: { id: supplierId, marketId } }),
      prisma.product.count({ where: { marketId, id: { in: normalized.map(i => i.productId) } } })
    ]);
    if (!supplier || count !== normalized.length) {
      return res.status(400).json({ message: "Fornecedor ou produto não pertence ao estabelecimento." });
    }
    const total = amount(normalized.reduce((sum, item) => sum + item.total, 0));
    if (!Number.isSafeInteger(Math.round(total * 100))) {
      return res.status(400).json({ message: "Valor total inválido." });
    }
    const amountCents = Math.round(total * 100);
    // Prisma Int utiliza inteiro de 32 bits para os valores financeiros.
    if (amountCents < installmentCount || amountCents > 2147483647) {
      return res.status(400).json({ message: "O total do romaneio deve ser positivo e compatível com o Financeiro." });
    }
    // Compra e lançamento financeiro são criados juntos: ou ambos salvam, ou nenhum salva.
    const purchase = await prisma.$transaction(async tx => {
      const created = await tx.purchase.create({
        data: {
          marketId, supplierId,
          reference: typeof reference === "string" ? reference.trim() || null : null,
          total,
          items: { create: normalized }
        },
        include: { items: true, supplier: true }
      });
      // Cada parcela possui valor inteiro em centavos; o resto fica nas primeiras parcelas.
      const baseCents = Math.floor(amountCents / installmentCount);
      const remainder = amountCents % installmentCount;
      for (let part = 0; part < installmentCount; part++) {
        const monthIndex = payableAsDate.getUTCMonth() + part;
        const year = payableAsDate.getUTCFullYear();
        const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
        const date = new Date(Date.UTC(year, monthIndex, Math.min(payableAsDate.getUTCDate(), lastDay), 12));
        await tx.financialEntry.create({
          data: {
            marketId, purchaseId: created.id,
            type: "PAYABLE", category: "Compras de mercadorias",
            description: `Compra - ${supplier.name}${created.reference ? ` (${created.reference})` : ""}${installmentCount > 1 ? ` - ${part + 1}/${installmentCount}` : ""}`,
            amountCents: baseCents + (part < remainder ? 1 : 0), dueDate: date,
            installmentGroup: created.id, installmentNumber: part + 1, installmentCount,
            status: "OPEN", notes: "Gerado automaticamente pelo romaneio."
          }
        });
      }
      return created;
    });
    return res.status(201).json({ purchase });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Erro ao criar compra." });
  }
});

purchasesRoutes.post("/:id/receive", async (req: AuthenticatedRequest, res) => {
  if (!canManage(req)) return res.status(403).json({ message: "Sem permissão." });
  const marketId = req.user!.marketId;
  try {
    const purchase = await prisma.$transaction(async tx => {
      // Alteração condicional garante que o recebimento não seja duplicado.
      const claimed = await tx.purchase.updateMany({
        where: { id: req.params.id, marketId, status: "DRAFT" },
        data: { status: "RECEIVED", receivedAt: new Date() }
      });
      if (claimed.count !== 1) return null;
      const current = await tx.purchase.findFirst({
        where: { id: req.params.id, marketId },
        include: { items: true }
      });
      if (!current) throw new Error("Compra não encontrada após atualização.");
      for (const item of current.items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, marketId } });
        if (!product) throw new Error("Produto não encontrado no estabelecimento.");
        const newStock = product.stock + item.quantity;
        if (!Number.isSafeInteger(newStock)) throw new Error("Estoque excede o limite permitido.");
        // Custo médio ponderado sobre o saldo em estoque e a entrada confirmada.
        const weighted = newStock === 0 ? item.unitCost :
          amount((product.cost * product.stock + item.unitCost * item.quantity) / newStock);
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { increment: item.quantity }, cost: weighted }
        });
      }
      return current;
    });
    if (!purchase) return res.status(409).json({ message: "Compra inexistente ou já recebida." });
    return res.json({ purchase, message: "Mercadorias recebidas e estoque atualizado." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Não foi possível receber a compra." });
  }
});
