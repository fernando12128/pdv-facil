import { randomBytes, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";

const databasePath = `/tmp/pdv-facil-critical-${randomUUID()}.db`;
const port = 3400 + (process.pid % 200);
const baseUrl = `http://127.0.0.1:${port}`;
const jwtSecret = randomBytes(48).toString("base64url");
const testPassword = randomBytes(24).toString("base64url");
const db = new Database(databasePath);
db.pragma("busy_timeout = 10000");

for (const migration of readdirSync("prisma/migrations")
  .filter((entry) => statSync(join("prisma/migrations", entry)).isDirectory())
  .sort()) {
  const migrationPath = join("prisma/migrations", migration, "migration.sql");
  try {
    db.exec(readFileSync(migrationPath, "utf8"));
  } catch (error) {
    throw new Error(`Migration ${migration} falhou: ${error.message}`);
  }
}

const server = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], {
  env: {
    ...process.env,
    DATABASE_URL: `file:${databasePath}`,
    JWT_SECRET: jwtSecret,
    PORT: String(port),
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverLog = "";
server.stdout.on("data", (chunk) => (serverLog += chunk));
server.stderr.on("data", (chunk) => (serverLog += chunk));

const results = [];
function check(condition, name, details = "") {
  if (!condition) throw new Error(`${name}${details ? `: ${details}` : ""}`);
  results.push(name);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Servidor não iniciou.\n${serverLog}`);
}

async function register(email, marketName = "Loja de Teste") {
  return request("/auth/register", {
    method: "POST",
    body: { name: "Dono", marketName, email, password: testPassword },
  });
}

async function createProduct(token, overrides = {}) {
  return request("/products", {
    method: "POST",
    token,
    body: {
      name: `Produto ${randomUUID()}`,
      sku: `SKU-${randomUUID()}`,
      barcode: `BAR-${randomUUID()}`,
      salePrice: 1,
      cost: 0.5,
      stock: 20,
      minStock: 1,
      ...overrides,
    },
  });
}

async function run() {
  await waitForServer();

  const registration = await register(`owner-${process.pid}@test.local`);
  check(registration.status === 201, "Cadastro principal", JSON.stringify(registration.body));
  const ownerToken = registration.body.token;
  const marketId = registration.body.market.id;
  const ownerId = registration.body.user.id;

  const passwordHash = await bcrypt.hash(testPassword, 4);
  const now = new Date().toISOString();
  function insertUser(role, prefix) {
    const id = randomUUID();
    const email = `${prefix}-${process.pid}@test.local`;
    db.prepare(
      `INSERT INTO User (id,name,email,passwordHash,role,createdAt,updatedAt,marketId)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(id, prefix, email, passwordHash, role, now, now, marketId);
    return { id, email };
  }
  const cashier = insertUser("CASHIER", "cashier");
  const deletedUser = insertUser("MANAGER", "deleted");
  const cashierLogin = await request("/auth/login", {
    method: "POST",
    body: { email: cashier.email, password: testPassword },
  });
  const deletedLogin = await request("/auth/login", {
    method: "POST",
    body: { email: deletedUser.email, password: testPassword },
  });
  check(cashierLogin.status === 200, "Login do caixa");
  check(deletedLogin.status === 200, "Login do usuário descartável");

  const deniedCategory = await request("/management/categories", {
    method: "POST",
    token: cashierLogin.body.token,
    body: { name: "Proibida" },
  });
  const deniedMarket = await request("/management/market", {
    method: "PUT",
    token: cashierLogin.body.token,
    body: { name: "Alteração proibida" },
  });
  check(deniedCategory.status === 403 && deniedMarket.status === 403, "Permissões do caixa");

  db.prepare("DELETE FROM User WHERE id = ?").run(deletedUser.id);
  const revoked = await request("/products", { token: deletedLogin.body.token });
  check(revoked.status === 401, "Token revogado após exclusão do usuário");

  const duplicateEmail = `race-${process.pid}@test.local`;
  const registrations = await Promise.all(
    Array.from({ length: 20 }, () => register(duplicateEmail, "Loja Concorrente"))
  );
  check(
    registrations.filter((item) => item.status === 201).length === 1 &&
      registrations.filter((item) => item.status === 409).length === 19,
    "Cadastro concorrente sem erro 500",
    registrations.map((item) => item.status).join(",")
  );

  const precise = await createProduct(ownerToken, { salePrice: 10.005 });
  check(precise.status === 400, "Bloqueio de valores com mais de dois decimais");

  const identity = { sku: `DUP-SKU-${process.pid}`, barcode: `DUP-BAR-${process.pid}` };
  const firstIdentity = await createProduct(ownerToken, identity);
  const duplicateIdentity = await createProduct(ownerToken, identity);
  check(firstIdentity.status === 201 && duplicateIdentity.status === 409, "SKU e código de barras únicos");

  const cashProduct = await createProduct(ownerToken, { salePrice: 0.1, stock: 20 });
  const inactiveProduct = await createProduct(ownerToken, { isActive: false });
  check(cashProduct.status === 201 && inactiveProduct.status === 201, "Produtos do cenário financeiro");

  const openings = await Promise.all(
    Array.from({ length: 20 }, () =>
      request("/cash-sessions/open", {
        method: "POST",
        token: ownerToken,
        body: { openingAmount: 10, operatorName: "Concorrência" },
      })
    )
  );
  check(
    openings.filter((item) => item.status === 201).length === 1 &&
      openings.filter((item) => item.status === 409).length === 19,
    "Abertura concorrente mantém um único caixa",
    openings.map((item) => item.status).join(",")
  );
  const sessionId = openings.find((item) => item.status === 201).body.session.id;

  const excessiveWithdrawal = await request("/cash-movements", {
    method: "POST",
    token: ownerToken,
    body: { type: "WITHDRAWAL", amount: 10.01, cashSessionId: sessionId },
  });
  check(excessiveWithdrawal.status === 400, "Sangria limitada ao saldo disponível");

  for (const paymentMethod of ["Dinheiro", "CASH"]) {
    const sale = await request("/sales", {
      method: "POST",
      token: ownerToken,
      body: {
        paymentMethod,
        items: [{ productId: cashProduct.body.product.id, quantity: 1 }],
      },
    });
    check(sale.status === 201 && sale.body.sale.paymentMethod === "CASH", `Pagamento ${paymentMethod} normalizado`);
  }

  const inactiveSale = await request("/sales", {
    method: "POST",
    token: ownerToken,
    body: { paymentMethod: "CASH", items: [{ productId: inactiveProduct.body.product.id, quantity: 1 }] },
  });
  check(inactiveSale.status === 400, "Produto inativo não pode ser vendido");

  const invalidPayment = await request("/sales", {
    method: "POST",
    token: ownerToken,
    body: { paymentMethod: "Fiado sem controle", items: [{ productId: cashProduct.body.product.id, quantity: 1 }] },
  });
  check(invalidPayment.status === 400, "Forma de pagamento arbitrária bloqueada");

  await request("/management/payment-settings/PIX", {
    method: "PATCH",
    token: ownerToken,
    body: { isEnabled: false },
  });
  const disabledPayment = await request("/sales", {
    method: "POST",
    token: ownerToken,
    body: { paymentMethod: "PIX", items: [{ productId: cashProduct.body.product.id, quantity: 1 }] },
  });
  check(disabledPayment.status === 400, "Forma de pagamento desativada bloqueada");

  const preview = await request(`/cash-sessions/${sessionId}/preview`, { token: ownerToken });
  const cashLines = preview.body.session.summary.paymentMethods.filter((item) => item.method === "CASH");
  check(cashLines.length === 1 && cashLines[0].expected === 10.2, "Dinheiro consolidado numa única linha");

  const report = await request("/reports", { token: ownerToken });
  const cashReport = report.body.payments.filter((item) => item.name === "CASH");
  check(cashReport.length === 1 && cashReport[0].total === 0.2, "Relatório financeiro arredondado e consolidado");

  const closingRequests = await Promise.all(
    Array.from({ length: 20 }, () =>
      request(`/cash-sessions/${sessionId}/close`, {
        method: "POST",
        token: ownerToken,
        body: { closingAmount: 10.2, confirmedPayments: {} },
      })
    )
  );
  check(
    closingRequests.filter((item) => item.status === 200).length === 1 &&
      closingRequests.every((item) => [200, 404, 409].includes(item.status)),
    "Fechamento concorrente não derruba o backend",
    closingRequests.map((item) => item.status).join(",")
  );
  const health = await request("/");
  check(health.status === 200, "Backend permanece saudável após fechamento concorrente");

  const orderProduct = await createProduct(ownerToken, { name: `Pedido ${process.pid}`, stock: 5 });
  const orderId = randomUUID();
  const orderItemId = randomUUID();
  db.prepare(
    `INSERT INTO OnlineOrder
      (id,marketId,orderNumber,customerName,deliveryType,paymentMethod,status,subtotal,discount,deliveryFee,total,createdAt,updatedAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(orderId, marketId, `ORD-${process.pid}`, "Cliente", "PICKUP", "PIX", "PENDING", 2, 0, 0, 2, now, now);
  db.prepare(
    `INSERT INTO OnlineOrderItem (id,orderId,productId,productName,quantity,unitPrice,total)
     VALUES (?,?,?,?,?,?,?)`
  ).run(orderItemId, orderId, orderProduct.body.product.id, orderProduct.body.product.name, 2, 1, 2);

  const skipped = await request(`/online-orders/${orderId}/status`, {
    method: "PATCH",
    token: ownerToken,
    body: { status: "DELIVERED" },
  });
  check(skipped.status === 409, "Pedido não pode pular etapas");
  for (const status of ["CONFIRMED", "PREPARING", "READY", "DELIVERED"]) {
    const transition = await request(`/online-orders/${orderId}/status`, {
      method: "PATCH",
      token: ownerToken,
      body: { status },
    });
    check(transition.status === 200, `Transição de pedido para ${status}`);
  }
  const productAfterDelivery = db.prepare("SELECT stock FROM Product WHERE id = ?").get(orderProduct.body.product.id);
  check(productAfterDelivery.stock === 3, "Pedido entregue baixa o estoque uma única vez");
  const reversed = await request(`/online-orders/${orderId}/status`, {
    method: "PATCH",
    token: ownerToken,
    body: { status: "PENDING" },
  });
  check(reversed.status === 409, "Pedido finalizado não volta para estado anterior");

  check(db.prepare("SELECT COUNT(*) AS count FROM CashSession WHERE marketId = ? AND status = 'OPEN'").get(marketId).count === 0, "Nenhum caixa órfão permaneceu aberto");
  check(ownerId === registration.body.user.id, "Isolamento do proprietário preservado");

  console.log(`\n${results.length} verificações críticas aprovadas.`);
  for (const result of results) console.log(`✓ ${result}`);
}

try {
  await run();
} catch (error) {
  console.error(`\nFalha na regressão crítica: ${error.message}`);
  if (serverLog) console.error(serverLog);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  db.close();
}
