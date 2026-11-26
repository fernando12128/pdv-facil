import { Router } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/authMiddleware";

export const financialOperationsRoutes = Router();
financialOperationsRoutes.use(authMiddleware);
financialOperationsRoutes.use((req: AuthenticatedRequest, res, next) =>
  ["OWNER", "MANAGER"].includes(req.user?.role || "") ? next() : res.status(403).json({ message: "Acesso restrito à administração." })
);

const fromDate = (value: unknown) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value + "T12:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
};
const cents = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const c = Math.round(value * 100);
  return Math.abs(value * 100 - c) < 1e-6 && Number.isSafeInteger(c) && c > 0 && c <= 2147483647 ? c : null;
};
const money = (value: number) => Math.round(value) / 100;
const nextMonth = (date: Date, targetDay: number) => {
  const year = date.getUTCFullYear(), month = date.getUTCMonth() + 1;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(days, targetDay), 12));
};
async function audit(tx: any, marketId: string, userId: string, action: string, targetType: string, targetId: string, details?: string) {
  await tx.financeAuditLog.create({ data: { marketId, userId, action, targetType, targetId, details: details || null } });
}

financialOperationsRoutes.get("/accounts", async (req: AuthenticatedRequest, res) => {
  const accounts = await prisma.bankAccount.findMany({ where: { marketId: req.user!.marketId }, orderBy: { createdAt: "desc" } });
  return res.json({ accounts });
});
financialOperationsRoutes.post("/accounts", async (req: AuthenticatedRequest, res) => {
  const { name, bankName, accountType, lastFour } = req.body || {};
  if (typeof name !== "string" || !name.trim() || name.length > 100 ||
      typeof bankName !== "string" || !bankName.trim() || bankName.length > 100 ||
      (lastFour && !/^\d{4}$/.test(String(lastFour))) ||
      !["CHECKING", "SAVINGS", "PAYMENT"].includes(accountType || "CHECKING")) {
    return res.status(400).json({ message: "Nome, banco, tipo ou últimos quatro dígitos inválidos." });
  }
  const marketId = req.user!.marketId;
  const account = await prisma.$transaction(async tx => {
    const created = await tx.bankAccount.create({ data: {
      marketId, name: name.trim(), bankName: bankName.trim(),
      accountType: accountType || "CHECKING", lastFour: lastFour || null
    } });
    await audit(tx, marketId, req.user!.userId, "CREATE", "BANK_ACCOUNT", created.id);
    return created;
  });
  return res.status(201).json({ account });
});
financialOperationsRoutes.get("/transactions", async (req: AuthenticatedRequest, res) => {
  const transactions = await prisma.bankTransaction.findMany({
    where: { marketId: req.user!.marketId },
    include: { bankAccount: { select: { name: true, bankName: true } }, financialEntry: { select: { id: true, description: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1000
  });
  return res.json({ transactions: transactions.map(t => ({ ...t, amount: money(t.amountCents) })) });
});

// A interface faz parsing local de CSV/OFX. O backend recebe somente registros estruturados, nunca credenciais bancárias.
financialOperationsRoutes.post("/transactions/import", async (req: AuthenticatedRequest, res) => {
  const { bankAccountId, transactions } = req.body || {};
  const marketId = req.user!.marketId;
  if (typeof bankAccountId !== "string" || !Array.isArray(transactions) || !transactions.length || transactions.length > 1000)
    return res.status(400).json({ message: "Conta e extrato são obrigatórios (máximo 1000 linhas)." });
  const account = await prisma.bankAccount.findFirst({ where: { id: bankAccountId, marketId, active: true } });
  if (!account) return res.status(404).json({ message: "Conta não encontrada." });
  const rows: Array<{ externalId: string; description: string; amountCents: number; date: Date }> = [];
  const repeatedRows = new Map<string, number>();
  for (const [index, row] of transactions.entries()) {
    const date = fromDate(row?.date), value = Number(row?.amount);
    const absoluteCents = cents(Math.abs(value));
    const description = typeof row?.description === "string" ? row.description.trim() : "";
    if (!date || !absoluteCents || !description || description.length > 300 || !Number.isFinite(value) ||
        (row.externalId != null && (typeof row.externalId !== "string" || row.externalId.length > 160)))
      return res.status(400).json({ message: `Linha ${index + 1}: data, descrição ou valor inválido.` });
    const amountCents = value < 0 ? -absoluteCents : absoluteCents;
    // Arquivos sem FITID podem conter dois pagamentos idênticos no mesmo dia.
    // A ocorrência preserva ambos e mantém deduplicação em reimportação do mesmo arquivo.
    const fingerprint = JSON.stringify({ bankAccountId, date: row.date, amountCents, description });
    const occurrence = (repeatedRows.get(fingerprint) || 0) + 1;
    repeatedRows.set(fingerprint, occurrence);
    const externalId = String(row.externalId || "").trim() ||
      createHash("sha256").update(JSON.stringify({ fingerprint, occurrence })).digest("hex");
    rows.push({ date, amountCents, description, externalId });
  }
  try {
    const result = await prisma.$transaction(async tx => {
      let added = 0;
      for (const row of rows) {
        const existing = await tx.bankTransaction.findUnique({
          where: { bankAccountId_externalId: { bankAccountId, externalId: row.externalId } },
          select: { id: true }
        });
        if (existing) continue;
        await tx.bankTransaction.create({ data: { marketId, bankAccountId, ...row } });
        added++;
      }
      await audit(tx, marketId, req.user!.userId, "IMPORT", "BANK_ACCOUNT", bankAccountId, JSON.stringify({ submitted: rows.length, added }));
      return added;
    });
    return res.status(201).json({ added: result, duplicates: rows.length - result });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Não foi possível importar o extrato." });
  }
});
financialOperationsRoutes.get("/transactions/:id/suggestions", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  const movement = await prisma.bankTransaction.findFirst({ where: { id: req.params.id, marketId, status: "UNMATCHED" } });
  if (!movement) return res.status(404).json({ message: "Movimentação não encontrada ou já conciliada." });
  const entries = await prisma.financialEntry.findMany({ where: {
    marketId, status: { in: ["OPEN", "SETTLED"] }, bankTransactionId: null,
    type: movement.amountCents < 0 ? "PAYABLE" : "RECEIVABLE",
    amountCents: Math.abs(movement.amountCents),
    dueDate: { gte: new Date(movement.date.getTime() - 30 * 86400000), lte: new Date(movement.date.getTime() + 30 * 86400000) }
  }, orderBy: { dueDate: "asc" }, take: 20 });
  return res.json({ suggestions: entries.map(e => ({ ...e, amount: money(e.amountCents) })) });
});
financialOperationsRoutes.post("/transactions/:id/reconcile", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId, entryId = req.body?.entryId;
  if (typeof entryId !== "string") return res.status(400).json({ message: "Selecione um lançamento." });
  try {
    const result = await prisma.$transaction(async tx => {
      const movement = await tx.bankTransaction.findFirst({ where: { id: req.params.id, marketId, status: "UNMATCHED" } });
      const entry = await tx.financialEntry.findFirst({ where: { id: entryId, marketId, status: { in: ["OPEN", "SETTLED"] }, bankTransactionId: null } });
      if (!movement || !entry) return "NOT_FOUND";
      if (entry.amountCents !== Math.abs(movement.amountCents) ||
          entry.type !== (movement.amountCents < 0 ? "PAYABLE" : "RECEIVABLE")) return "MISMATCH";
      const claimed = await tx.bankTransaction.updateMany({
        where: { id: movement.id, marketId, status: "UNMATCHED" }, data: { status: "MATCHED" }
      });
      if (claimed.count !== 1) return "NOT_FOUND";
      const claimedEntry = await tx.financialEntry.updateMany({
        where: { id: entryId, marketId, status: "OPEN", bankTransactionId: null },
        data: { bankTransactionId: movement.id, status: "SETTLED", settledAt: movement.date }
      });
      if (claimedEntry.count !== 1) throw new Error("Lançamento alterado durante conciliação.");
      await audit(tx, marketId, req.user!.userId, "RECONCILE", "BANK_TRANSACTION", movement.id, entry.id);
      return "OK";
    });
    if (result === "NOT_FOUND") return res.status(409).json({ message: "Movimentação ou lançamento indisponível." });
    if (result === "MISMATCH") return res.status(400).json({ message: "O valor ou o tipo não coincide." });
    return res.json({ message: "Conciliação registrada." });
  } catch (err) { console.error(err); return res.status(500).json({ message: "Falha ao conciliar." }); }
});
// Classifica movimentações que não possuem lançamento prévio (ex.: tarifa bancária).
financialOperationsRoutes.post("/transactions/:id/classify", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  const category = typeof req.body?.category === "string" ? req.body.category.trim() : "";
  if (!category || category.length > 100)
    return res.status(400).json({ message: "Informe uma categoria (até 100 caracteres)." });
  try {
    const entry = await prisma.$transaction(async tx => {
      const movement = await tx.bankTransaction.findFirst({ where: { id: req.params.id, marketId, status: "UNMATCHED" } });
      if (!movement) return null;
      const claimed = await tx.bankTransaction.updateMany({
        where: { id: movement.id, marketId, status: "UNMATCHED" }, data: { status: "MATCHED" }
      });
      if (!claimed.count) return null;
      const created = await tx.financialEntry.create({ data: {
        marketId, bankTransactionId: movement.id,
        type: movement.amountCents < 0 ? "PAYABLE" : "RECEIVABLE",
        category, description: movement.description,
        amountCents: Math.abs(movement.amountCents), dueDate: movement.date,
        settledAt: movement.date, status: "SETTLED",
        notes: "Gerado por classificação manual de extrato bancário."
      } });
      await audit(tx, marketId, req.user!.userId, "CLASSIFY", "BANK_TRANSACTION", movement.id, created.id);
      return created;
    });
    return entry ? res.status(201).json({ entry }) : res.status(409).json({ message: "Movimentação já conciliada ou inexistente." });
  } catch (error) { console.error(error); return res.status(500).json({ message: "Falha ao classificar." }); }
});

financialOperationsRoutes.get("/recurrences", async (req: AuthenticatedRequest, res) => {
  return res.json({ rules: await prisma.recurringRule.findMany({ where: { marketId: req.user!.marketId }, orderBy: { createdAt: "desc" } }) });
});
financialOperationsRoutes.post("/recurrences", async (req: AuthenticatedRequest, res) => {
  const { type, description, category, amount, nextDueDate } = req.body || {};
  const amountCents = cents(amount), date = fromDate(nextDueDate);
  if (!["PAYABLE","RECEIVABLE"].includes(type) || !description?.trim() || !category?.trim() ||
      typeof description !== "string" || typeof category !== "string" || description.length > 160 || category.length > 100 ||
      !amountCents || !date) return res.status(400).json({ message: "Dados da recorrência inválidos." });
  const marketId = req.user!.marketId;
  const rule = await prisma.$transaction(async tx => {
    const created = await tx.recurringRule.create({ data: {
      marketId, type, description: description.trim(), category: category.trim(), amountCents,
      dayOfMonth: date.getUTCDate(), nextDueDate: date
    } });
    await audit(tx, marketId, req.user!.userId, "CREATE", "RECURRENCE", created.id);
    return created;
  });
  return res.status(201).json({ rule });
});
financialOperationsRoutes.post("/recurrences/generate", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  // Gera até o fim do próximo mês; não é um agendador de segundo plano.
  const now = new Date();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 0, 23, 59));
  try {
    const count = await prisma.$transaction(async tx => {
      const rules = await tx.recurringRule.findMany({ where: { marketId, active: true, nextDueDate: { lte: cutoff } } });
      let count = 0;
      for (const rule of rules) {
        let due = rule.nextDueDate;
        for (let i = 0; i < 120 && due <= cutoff; i++) {
          await tx.financialEntry.create({ data: {
            marketId, recurrenceId: rule.id, type: rule.type, category: rule.category,
            description: rule.description, amountCents: rule.amountCents, dueDate: due
          } });
          count++;
          due = nextMonth(due, rule.dayOfMonth);
        }
        await tx.recurringRule.update({ where: { id: rule.id }, data: { nextDueDate: due } });
      }
      if (count) await audit(tx, marketId, req.user!.userId, "GENERATE", "RECURRENCES", marketId, String(count));
      return count;
    });
    return res.json({ generated: count });
  } catch (err) { console.error(err); return res.status(500).json({ message: "Falha ao gerar recorrências." }); }
});
financialOperationsRoutes.patch("/recurrences/:id/disable", async (req: AuthenticatedRequest, res) => {
  const marketId = req.user!.marketId;
  const updated = await prisma.recurringRule.updateMany({ where: { id: req.params.id, marketId }, data: { active: false } });
  return updated.count ? res.json({ message: "Recorrência desativada." }) : res.status(404).json({ message: "Recorrência não encontrada." });
});
financialOperationsRoutes.get("/audit", async (req: AuthenticatedRequest, res) => {
  const logs = await prisma.financeAuditLog.findMany({ where: { marketId: req.user!.marketId }, orderBy: { createdAt: "desc" }, take: 100 });
  return res.json({ logs });
});
financialOperationsRoutes.get("/connectors", async (_req, res) => {
  return res.json({ providers: [
    { id: "OPEN_FINANCE", label: "Open Finance", status: "NOT_CONFIGURED" },
    { id: "CARD_ACQUIRERS", label: "Adquirentes / maquininhas", status: "NOT_CONFIGURED" }
  ], mode: "MANUAL_ONLY" });
});
