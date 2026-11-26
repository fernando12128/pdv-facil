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
  console.log("Integração romaneio/financeiro aprovada.");
} catch (error) {
  console.error(error);
  console.error(serverLogs);
  process.exitCode = 1;
} finally {
  server.kill();
  await new Promise(resolve => server.once("exit", resolve));
  rmSync(temp, { recursive: true, force: true });
}
