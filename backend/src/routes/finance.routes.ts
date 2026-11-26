import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/authMiddleware";

export const financeRoutes = Router();
financeRoutes.use(authMiddleware);
financeRoutes.use((req: AuthenticatedRequest, res, next) => {
  if (!["OWNER", "MANAGER"].includes(req.user?.role || "")) return res.status(403).json({ message: "Acesso restrito à administração." });
  next();
});
const validTypes = ["PAYABLE", "RECEIVABLE"];
const cents = (n: number) => Math.round(n * 100);
const money = (n: number) => Math.round(n) / 100;
const format = (entry: { amountCents: number; [key: string]: any }) => ({ ...entry, amount: money(entry.amountCents) });
const dateOnly = (value: string) => new Date(value + "T12:00:00.000Z");
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(dateOnly(s).getTime());
const monthBounds = (month: string) => {
  const from = new Date(month + "-01T00:00:00.000Z");
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { gte: from, lt: to };
};
financeRoutes.get("/entries", async (req: AuthenticatedRequest, res) => {
  const entries = await prisma.financialEntry.findMany({ where: { marketId: req.user!.marketId }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }] });
  res.json({ entries: entries.map(format) });
});
financeRoutes.post("/entries", async (req: AuthenticatedRequest, res) => {
  const { description, category, dueDate, notes, type } = req.body;
  const amount = Number(req.body.amount);
  if (!validTypes.includes(type) || !String(description || "").trim() || !String(category || "").trim() || !validDate(String(dueDate)) || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(cents(amount))) return res.status(400).json({ message: "Preencha tipo, descrição, categoria, vencimento e valor positivo válidos." });
  const entry = await prisma.financialEntry.create({ data: { marketId: req.user!.marketId, type, description: String(description).trim(), category: String(category).trim(), dueDate: dateOnly(dueDate), amountCents: cents(amount), notes: notes ? String(notes).trim() : null } });
  res.status(201).json({ entry: format(entry) });
});
financeRoutes.patch("/entries/:id/settle", async (req: AuthenticatedRequest, res) => {
  const existing = await prisma.financialEntry.findFirst({ where: { id: req.params.id, marketId: req.user!.marketId } });
  if (!existing) return res.status(404).json({ message: "Lançamento não encontrado." });
  if (existing.status === "SETTLED") return res.status(409).json({ message: "Lançamento já liquidado." });
  const date = req.body.date ? String(req.body.date) : new Date().toISOString().slice(0, 10);
  if (!validDate(date)) return res.status(400).json({ message: "Data de liquidação inválida." });
  const entry = await prisma.$transaction(async tx => {
    const changed = await tx.financialEntry.updateMany({ where: { id: existing.id, marketId: req.user!.marketId, status: "OPEN" }, data: { status: "SETTLED", settledAt: dateOnly(date) } });
    if (!changed.count) return null;
    await tx.financeAuditLog.create({ data: { marketId: req.user!.marketId, userId: req.user!.userId, action: "SETTLE", targetType: "FINANCIAL_ENTRY", targetId: existing.id } });
    return tx.financialEntry.findUnique({ where: { id: existing.id } });
  });
  if (!entry) return res.status(409).json({ message: "Lançamento já liquidado." });
  res.json({ entry: format(entry) });
});
financeRoutes.delete("/entries/:id", async (req: AuthenticatedRequest, res) => {
  const linked = await prisma.financialEntry.findFirst({ where: { id: req.params.id, marketId: req.user!.marketId }, select: { purchaseId: true } });
  if (linked?.purchaseId) return res.status(409).json({ message: "Este lançamento pertence a um romaneio e não pode ser excluído manualmente." });
  const result = await prisma.financialEntry.deleteMany({ where: { id: req.params.id, marketId: req.user!.marketId, status: "OPEN", purchaseId: null } });
  if (!result.count) return res.status(404).json({ message: "Lançamento inexistente ou já liquidado." });
  res.json({ message: "Lançamento removido." });
});
financeRoutes.get("/reports", async (req: AuthenticatedRequest, res) => {
  const month = String(req.query.month || new Date().toISOString().slice(0, 7));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ message: "Mês inválido." });
  const period = monthBounds(month);
  const marketId = req.user!.marketId;
  const [entries, sales] = await Promise.all([
    prisma.financialEntry.findMany({ where: { marketId } }),
    prisma.productSale.findMany({ where: { marketId, status: "COMPLETED", createdAt: period }, include: { items: true } })
  ]);
  const settled = entries.filter(e => e.settledAt && e.settledAt >= period.gte && e.settledAt < period.lt);
  const due = entries.filter(e => e.dueDate >= period.gte && e.dueDate < period.lt);
  const salesRevenue = cents(sales.reduce((s, sale) => s + sale.total, 0));
  const cmv = cents(sales.reduce((sum, sale) => sum + sale.items.reduce((line, item) => line + item.costAtSale * item.quantity, 0), 0));
  const receipts = settled.filter(e => e.type === "RECEIVABLE").reduce((s, e) => s + e.amountCents, 0);
  const payments = settled.filter(e => e.type === "PAYABLE").reduce((s, e) => s + e.amountCents, 0);
  const expectedReceipts = due.filter(e => e.type === "RECEIVABLE" && e.status === "OPEN").reduce((s, e) => s + e.amountCents, 0);
  const expectedPayments = due.filter(e => e.type === "PAYABLE" && e.status === "OPEN").reduce((s, e) => s + e.amountCents, 0);
  const operationalPayments = settled.filter(e => e.type === "PAYABLE" && !e.purchaseId);
  const operationalExpenses = operationalPayments.reduce((sum, e) => sum + e.amountCents, 0);
  const categories = [...new Set(operationalPayments.map(e => e.category))].map(category => ({ category, total: money(operationalPayments.filter(e => e.category === category).reduce((s, e) => s + e.amountCents, 0)) })).sort((a,b)=> b.total-a.total);
  // Sales revenue is accrual from the PDV. Cash received from sales is NOT inferred: card settlement may be delayed.
  res.json({ month, dre: { salesRevenue: money(salesRevenue), otherRevenue: money(receipts), cmv: money(cmv), expenses: money(operationalExpenses), result: money(salesRevenue + receipts - cmv - operationalExpenses), categories, basis: "DRE gerencial: CMV pelo custo registrado nas novas vendas; compras de estoque não são despesa novamente. Vendas antigas podem não ter custo histórico. Despesas manuais por liquidação, ainda não contábil." }, cashFlow: { confirmedInflows: money(receipts), confirmedOutflows: money(payments), net: money(receipts - payments), pendingInflows: money(expectedReceipts), pendingOutflows: money(expectedPayments), notice: "Fluxo manual. Vendas do PDV não entram como recebimento até integração de liquidação, evitando contagem indevida." } });
});
