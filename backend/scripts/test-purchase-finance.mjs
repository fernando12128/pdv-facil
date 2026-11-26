import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, readdirSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import Database from "better-sqlite3";

const backendDir = process.cwd();
const temp = mkdtempSync(join(tmpdir(), "pdv-compra-financeiro-"));
const dbPath = join(temp, "test.sqlite").replaceAll("\\", "/");
const dbUrl = `file:${dbPath}`;
const db = new Database(dbPath);
db.pragma("foreign_keys=ON");
const migrations = readdirSync(join(backendDir, "prisma/migrations"))
  .filter(name => existsSync(join(backendDir, "prisma/migrations", name, "migration.sql"))).sort();
for (const migration of migrations) {
  db.exec(readFileSync(join(backendDir, "prisma/migrations", migration, "migration.sql"), "utf8"));
}
db.close();

const port = await new Promise((resolve, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const port = address && typeof address !== "string" ? address.port : 0;
    server.close(() => resolve(port));
  });
});
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
  cwd: backendDir,
  env: { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: "chave-teste-compra-financeiro", ACCOUNT_EMAIL_MODE: "mock", NODE_ENV: "test", PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"]
});
let serverLogs = "";
server.stdout.on("data", chunk => { serverLogs += chunk; });
server.stderr.on("data", chunk => { serverLogs += chunk; });

async function request(path, { token, method = "GET", body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, data: await response.json().catch(() => null) };
}
function assert(condition, description, details = "") {
  if (!condition) throw new Error(`FAIL ${description} ${details}`);
  console.log(`PASS ${description}`);
}
async function register(tag) {
  const email = `test-${tag}@example.test`;
  const signup = await request("/auth/register", { method: "POST", body: { email, password: "senha-de-teste-123", marketName: `Empresa ${tag}` } });
  assert(signup.status === 201 && signup.data.developmentToken, "Cadastro em mock");
  const verified = await request("/auth/verify-email", { method: "POST", body: { email, token: signup.data.developmentToken } });
  assert(verified.status === 200, "Confirmação da conta");
  const login = await request("/auth/login", { method: "POST", body: { email, password: "senha-de-teste-123" } });
  assert(login.status === 200, "Login");
  return login.data.token;
}

try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(serverLogs);
    try { if ((await fetch(base + "/")).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert(ready, "API iniciada", serverLogs);
  const tokenA = await register("a");
  const tokenB = await register("b");
  const product = await request("/products", { token: tokenA, method: "POST", body: {
    name: "Produto Teste", salePrice: 20, cost: 10, stock: 5
  } });
  assert(product.status === 201, "Produto criado");
  const supplier = await request("/purchases/suppliers", { token: tokenA, method: "POST", body: { name: "Distribuidora Teste" } });
  assert(supplier.status === 201, "Fornecedor criado");
  const dueDate = "2026-12-10";
  const purchase = await request("/purchases", { token: tokenA, method: "POST", body: {
    supplierId: supplier.data.supplier.id, reference: "ROM-TESTE-001", dueDate,
    items: [{ productId: product.data.product.id, quantity: 4, unitCost: 12.5 }]
  } });
  assert(purchase.status === 201 && purchase.data.purchase.total === 50, "Romaneio criado");
  const id = purchase.data.purchase.id;
  const ledger = await request("/finance/entries", { token: tokenA });
  const linked = ledger.data.entries.filter(item => item.purchaseId === id);
  assert(ledger.status === 200 && linked.length === 1, "Existe exatamente uma conta a pagar para o romaneio");
  assert(linked[0].amountCents === 5000 && linked[0].type === "PAYABLE" && linked[0].status === "OPEN" &&
    linked[0].dueDate.startsWith(dueDate), "Conta a pagar com valor, vencimento e status corretos");
  const foreign = await request("/finance/entries", { token: tokenB });
  assert(foreign.status === 200 && foreign.data.entries.every(item => item.purchaseId !== id), "Outra empresa não visualiza lançamento");
  const forbiddenDelete = await request(`/finance/entries/${linked[0].id}`, { token: tokenA, method: "DELETE" });
  assert(forbiddenDelete.status === 409, "Exclusão manual da conta vinculada é bloqueada");
  const receiving = await request(`/purchases/${id}/receive`, { token: tokenA, method: "POST" });
  assert(receiving.status === 200, "Entrada de estoque registrada");
  const duplicate = await request(`/purchases/${id}/receive`, { token: tokenA, method: "POST" });
  assert(duplicate.status === 409, "Recebimento duplicado bloqueado");
  const after = await request("/finance/entries", { token: tokenA });
  assert(after.data.entries.filter(item => item.purchaseId === id).length === 1, "Recebimento não duplica o financeiro");
  const paid = await request(`/finance/entries/${linked[0].id}/settle`, { token: tokenA, method: "PATCH" });
  assert(paid.status === 200 && paid.data.entry.status === "SETTLED", "Conta pode ser liquidada no Financeiro");
  const parcelled = await request("/purchases", { token: tokenA, method: "POST", body: {
    supplierId: supplier.data.supplier.id, reference: "ROM-PARCELADO", dueDate: "2026-12-10", installmentCount: 3,
    items: [{ productId: product.data.product.id, quantity: 4, unitCost: 12.5 }]
  } });
  assert(parcelled.status === 201, "Romaneio parcelado criado");
  const installmentEntries = (await request("/finance/entries", { token: tokenA })).data.entries
    .filter(entry => entry.purchaseId === parcelled.data.purchase.id);
  assert(installmentEntries.length === 3 && installmentEntries.reduce((sum,e) => sum + e.amountCents,0) === 5000,
    "Parcelas totalizam o romaneio sem perder centavos");
  const account = await request("/finance-ops/accounts", { token: tokenA, method: "POST", body: {
    name: "Conta de teste", bankName: "Banco fictício", accountType: "CHECKING", lastFour: "1234"
  } });
  assert(account.status === 201, "Conta bancária de teste criada");
  const foreignAccounts = await request("/finance-ops/accounts", { token: tokenB });
  assert(foreignAccounts.status === 200 && foreignAccounts.data.accounts.length === 0, "Contas bancárias isoladas");
  const idBank = account.data.account.id;
  const extractPayload = { bankAccountId: idBank, transactions: [
    { date: "2026-12-10", description: "Pagamento fornecedor", amount: -16.67, externalId: "OFX-TESTE-001" }
  ] };
  const imported = await request("/finance-ops/transactions/import", { token: tokenA, method: "POST", body: extractPayload });
  assert(imported.status === 201 && imported.data.added === 1, "Movimentação bancária importada");
  const repeated = await request("/finance-ops/transactions/import", { token: tokenA, method: "POST", body: extractPayload });
  assert(repeated.status === 201 && repeated.data.added === 0 && repeated.data.duplicates === 1, "Reimportação ignora duplicata");
  const statement = await request("/finance-ops/transactions", { token: tokenA });
  const movementId = statement.data.transactions[0].id;
  const suggestions = await request(`/finance-ops/transactions/${movementId}/suggestions`, { token: tokenA });
  assert(suggestions.status === 200 && suggestions.data.suggestions.some(e => e.purchaseId === undefined || e.id === installmentEntries[0].id),
    "Sugestão de conciliação encontra valor correspondente");
  const matched = await request(`/finance-ops/transactions/${movementId}/reconcile`, { token: tokenA, method: "POST",
    body: { entryId: installmentEntries.find(e => e.amountCents === 1667).id } });
  assert(matched.status === 200, "Conciliação manual liquida parcela");
  const repeatMatch = await request(`/finance-ops/transactions/${movementId}/reconcile`, { token: tokenA, method: "POST",
    body: { entryId: installmentEntries[1].id } });
  assert(repeatMatch.status === 409, "Conciliação duplicada bloqueada");
  const recurrence = await request("/finance-ops/recurrences", { token: tokenA, method: "POST", body: {
    type: "PAYABLE", description: "Aluguel", category: "Despesas fixas", amount: 150,
    nextDueDate: "2026-12-05"
  } });
  assert(recurrence.status === 201, "Recorrência cadastrada");
  const generated = await request("/finance-ops/recurrences/generate", { token: tokenA, method: "POST" });
  assert(generated.status === 200 && generated.data.generated > 0, "Vencimentos gerados");
  const generatedAgain = await request("/finance-ops/recurrences/generate", { token: tokenA, method: "POST" });
  assert(generatedAgain.status === 200 && generatedAgain.data.generated === 0, "Geração não duplica vencimentos");
  const audit = await request("/finance-ops/audit", { token: tokenA });
  assert(audit.status === 200 && audit.data.logs.some(l => l.action === "RECONCILE"), "Auditoria da conciliação registrada");

  const unmatchedImport = await request("/finance-ops/transactions/import", { token: tokenA, method: "POST", body: {
    bankAccountId: idBank, transactions: [{ date: "2026-12-11", description: "Tarifa teste", amount: -3.25, externalId: "FEE-TEST-001" }]
  } });
  assert(unmatchedImport.status === 201 && unmatchedImport.data.added === 1, "Tarifa bancária importada");
  const allMovements = await request("/finance-ops/transactions", { token: tokenA });
  const feeMovement = allMovements.data.transactions.find(m => m.externalId === "FEE-TEST-001");
  const classified = await request(`/finance-ops/transactions/${feeMovement.id}/classify`, {
    token: tokenA, method: "POST", body: { category: "Tarifas bancárias" }
  });
  assert(classified.status === 201 && classified.data.entry.amountCents === 325, "Tarifa classificada como despesa liquidada");
  const cardRule = await request("/finance-ops/card-fees", { token: tokenA, method: "PUT", body: {
    paymentMethod: "DEBIT", providerName: "Maquininha fictícia", feePercent: 1.75, settlementDays: 1
  } });
  assert(cardRule.status === 200 && cardRule.data.rule.feeBps === 175, "Taxa de cartão salva por empresa");
  const otherRules = await request("/finance-ops/card-fees", { token: tokenB });
  assert(otherRules.status === 200 && otherRules.data.rules.length === 0, "Configuração de cartão não vaza entre empresas");
  const forecast = await request("/finance-ops/card-forecast?month=2026-12", { token: tokenA });
  assert(forecast.status === 200 && Array.isArray(forecast.data.forecast), "Previsão de recebíveis disponível");
  console.log("Integração romaneio/financeiro aprovada.");
} catch (error) {
  console.error(error);
  console.error(serverLogs);
  process.exitCode = 1;
} finally {
  server.kill();
  if (server.exitCode === null && server.signalCode === null) {
    await new Promise(resolve => server.once("exit", resolve));
  }
  rmSync(temp, { recursive: true, force: true });
}
