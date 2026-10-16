import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Database from 'better-sqlite3';

const backendDir = resolve(import.meta.dirname, '..');
const dbPath = `/tmp/pdv-facil-p0-${process.pid}.sqlite`;
const dbUrl = `file:${dbPath}`;
const db = new Database(dbPath);
db.pragma('foreign_keys=ON');
for (const dir of readdirSync(join(backendDir, 'prisma/migrations')).sort()) {
  const file = join(backendDir, 'prisma/migrations', dir, 'migration.sql');
  if (existsSync(file)) db.exec(readFileSync(file, 'utf8'));
}
db.close();

const port = await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const assigned = probe.address().port;
    probe.close((error) => error ? reject(error) : resolvePort(assigned));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['-r', 'tsx/cjs', 'src/server.ts'], {
  cwd: backendDir,
  env: { ...process.env, DATABASE_URL: dbUrl, JWT_SECRET: 'p0-integration-test-secret', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });

const results = [];
function check(name, condition, details = '') {
  results.push({ name, passed: Boolean(condition), details });
  console.log(`${condition ? 'PASS' : 'FAIL'} ${name}${details ? ` — ${details}` : ''}`);
}
async function waitReady() {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`API encerrou antes de iniciar. ${serverOutput}`);
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new Error(`API não iniciou. ${serverOutput}`);
}
async function request(path, { token, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}
async function createCompany(slug) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: { name: `Owner ${slug}`, marketName: `Empresa ${slug}`, email: `${slug}@example.test`, password: 'senha-teste-123' },
  });
  if (result.status !== 201) throw new Error(`Cadastro falhou: ${JSON.stringify(result)}`);
  return result.data;
}
async function createProduct(token, name, stock, extra = {}) {
  const result = await request('/products', {
    method: 'POST', token, body: { name, salePrice: 10, stock, isVisibleOnline: true, ...extra },
  });
  if (result.status !== 201) throw new Error(`Produto falhou: ${JSON.stringify(result)}`);
  return result.data.product;
}

try {
  const migrationDbPath = `/tmp/pdv-facil-p0-migration-${process.pid}.sqlite`;
  const migrationDb = new Database(migrationDbPath);
  migrationDb.pragma('foreign_keys=ON');
  const migrationDirs = readdirSync(join(backendDir, 'prisma/migrations'))
    .filter((entry) => existsSync(join(backendDir, 'prisma/migrations', entry, 'migration.sql')))
    .sort();
  const p0Migration = migrationDirs.at(-1);
  for (const dir of migrationDirs.filter((entry) => entry !== p0Migration)) {
    migrationDb.exec(readFileSync(join(backendDir, 'prisma/migrations', dir, 'migration.sql'), 'utf8'));
  }
  migrationDb.exec(`
    INSERT INTO "User" ("id","name","email","passwordHash","updatedAt") VALUES ('legacy-user','Legacy','legacy@test.local','x',CURRENT_TIMESTAMP);
    INSERT INTO "Market" ("id","name","email","updatedAt","ownerId") VALUES ('legacy-market','Legacy','legacy@test.local',CURRENT_TIMESTAMP,'legacy-user');
    UPDATE "User" SET "marketId"='legacy-market' WHERE "id"='legacy-user';
    INSERT INTO "CashSession" ("id","marketId","userId","openingAmount") VALUES ('legacy-session-1','legacy-market','legacy-user',0),('legacy-session-2','legacy-market','legacy-user',0);
  `);
  migrationDb.exec(readFileSync(join(backendDir, 'prisma/migrations', p0Migration, 'migration.sql'), 'utf8'));
  const migratedSessions = migrationDb.prepare('SELECT "registerKey" FROM "CashSession" WHERE "marketId"=? ORDER BY "id"').all('legacy-market');
  check('Migração preserva múltiplos caixas abertos já existentes', migratedSessions.length === 2 && new Set(migratedSessions.map((row) => row.registerKey)).size === 2);
  migrationDb.close();
  try { (await import('node:fs/promises')).unlink(migrationDbPath); } catch {}

  await waitReady();
  const companyA = await createCompany('a');
  const companyB = await createCompany('b');
  const productA = await createProduct(companyA.token, 'Produto A', 5);
  const productB = await createProduct(companyB.token, 'Produto B', 7);
  const paymentSeed = new Database(dbPath);
  paymentSeed.prepare('INSERT INTO "PaymentSetting" ("id","marketId","type","isEnabled","createdAt","updatedAt") VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)').run(`disabled-pix-${process.pid}`, companyA.market.id, 'PIX', 0);
  paymentSeed.prepare('INSERT INTO "PaymentSetting" ("id","marketId","type","isEnabled","createdAt","updatedAt") VALUES (?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)').run(`disabled-cash-${process.pid}`, companyB.market.id, 'CASH', 0);
  paymentSeed.close();

  const publicMissing = await request('/public/products');
  check('Catálogo público exige empresa explícita', publicMissing.status === 400, `HTTP ${publicMissing.status}`);
  const publicA = await request(`/public/products?marketId=${companyA.market.id}`);
  check('Catálogo público retorna somente campos públicos da empresa solicitada', publicA.status === 200 && publicA.data.products.length === 1 && publicA.data.products[0].id === productA.id && !('stock' in publicA.data.products[0]) && !('minStock' in publicA.data.products[0]));
  const publicForeign = await request('/public/products?marketId=nao-existe');
  check('Catálogo público rejeita empresa inexistente', publicForeign.status === 404, `HTTP ${publicForeign.status}`);

  const companyAProducts = await request('/products', { token: companyA.token });
  check('Listagem autenticada permanece isolada por empresa', companyAProducts.status === 200 && companyAProducts.data.products.length === 1 && companyAProducts.data.products[0].id === productA.id);
  const foreignStock = await request(`/products/${productB.id}/stock`, { token: companyA.token, method: 'PATCH', body: { quantity: 50, type: 'ADD' } });
  check('Empresa A não altera produto da empresa B', foreignStock.status === 404 || foreignStock.status === 400, `HTTP ${foreignStock.status}`);

  const openA1 = await request('/cash-sessions/open', { token: companyA.token, method: 'POST', body: { registerKey: 'FRENTE-01', openingAmount: 100 } });
  const openA2 = await request('/cash-sessions/open', { token: companyA.token, method: 'POST', body: { registerKey: 'FRENTE-02', openingAmount: 0 } });
  const openB1 = await request('/cash-sessions/open', { token: companyB.token, method: 'POST', body: { registerKey: 'FRENTE-01', openingAmount: 0 } });
  const duplicateRegister = await request('/cash-sessions/open', { token: companyA.token, method: 'POST', body: { registerKey: 'FRENTE-01', openingAmount: 0 } });
  check('Empresa pode manter caixas simultâneos em terminais diferentes', openA1.status === 201 && openA2.status === 201, `HTTP ${openA1.status}/${openA2.status}`);
  check('Terminais iguais de empresas diferentes são isolados', openB1.status === 201, `HTTP ${openB1.status}`);
  const disabledCash = await request('/sales', { token: companyB.token, method: 'POST', body: { cashSessionId: openB1.data.session.id, idempotencyKey: 'disabled-cash', paymentMethod: 'CASH', items: [{ productId: productB.id, quantity: 1 }] } });
  check('Forma de pagamento CASH desativada não é liberada pelo padrão', disabledCash.status === 400, `HTTP ${disabledCash.status}`);
  check('Cada terminal aceita somente um caixa aberto', duplicateRegister.status === 409, `HTTP ${duplicateRegister.status}`);
  const invalidOpening = await request('/cash-sessions/open', { token: companyA.token, method: 'POST', body: { registerKey: 'CENTAVOS', openingAmount: 0.005 } });
  check('Abertura de caixa rejeita precisão monetária inválida', invalidOpening.status === 400, `HTTP ${invalidOpening.status}`);
  const foreignPreview = await request(`/cash-sessions/${openA1.data.session.id}/preview`, { token: companyB.token });
  check('Empresa B não consulta caixa aberto da empresa A', foreignPreview.status === 404, `HTTP ${foreignPreview.status}`);
  const racedOpens = await Promise.all(Array.from({ length: 12 }, (_, index) => request('/cash-sessions/open', {
    token: companyA.token, method: 'POST', body: { registerKey: 'RACE-01', openingAmount: index },
  })));
  check('Aberturas concorrentes criam exatamente um caixa por terminal', racedOpens.filter((result) => result.status === 201).length === 1 && racedOpens.every((result) => result.status === 201 || result.status === 409), `201=${racedOpens.filter((result) => result.status === 201).length}, outros=${racedOpens.filter((result) => result.status !== 201).map((result) => result.status).join(',')}`);
  const overdraw = await request('/cash-movements', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, type: 'WITHDRAWAL', amount: 100.01 } });
  check('Sangria acima do saldo disponível é bloqueada', overdraw.status === 400, `HTTP ${overdraw.status}`);
  const cashRaceSession = await request('/cash-sessions/open', { token: companyA.token, method: 'POST', body: { registerKey: 'SANGRIA-RACE', openingAmount: 100 } });
  const withdrawalRace = await Promise.all(Array.from({ length: 12 }, () => request('/cash-movements', { token: companyA.token, method: 'POST', body: { cashSessionId: cashRaceSession.data.session.id, type: 'WITHDRAWAL', amount: 10 } })));
  const withdrawalPreview = await request(`/cash-sessions/${cashRaceSession.data.session.id}/preview`, { token: companyA.token });
  check('Sangrias concorrentes respeitam o saldo e retornam respostas tratadas', withdrawalRace.filter((result) => result.status === 201).length === 10 && withdrawalRace.every((result) => result.status === 201 || result.status === 400) && withdrawalPreview.data.session.summary.expectedCash === 0, `201=${withdrawalRace.filter((result) => result.status === 201).length}; status=${withdrawalRace.map((result) => result.status).join(',')}; saldo=${withdrawalPreview.data.session.summary.expectedCash}`);

  const invalidPayment = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'bad-pay', paymentMethod: 'CRIPTO', items: [{ productId: productA.id, quantity: 1 }] } });
  check('Venda rejeita forma de pagamento desconhecida', invalidPayment.status === 400, `HTTP ${invalidPayment.status}`);
  const disabledPayment = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'disabled-pix', paymentMethod: 'PIX', items: [{ productId: productA.id, quantity: 1 }] } });
  check('Venda rejeita forma de pagamento desativada pela empresa', disabledPayment.status === 400, `HTTP ${disabledPayment.status}`);
  const inactiveProduct = await createProduct(companyA.token, 'Produto inativo', 2, { isActive: false });
  const inactiveSale = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'inactive-product', paymentMethod: 'CASH', items: [{ productId: inactiveProduct.id, quantity: 1 }] } });
  check('Produto inativo não pode ser vendido', inactiveSale.status === 400, `HTTP ${inactiveSale.status}`);
  const missingSession = await request('/sales', { token: companyA.token, method: 'POST', body: { idempotencyKey: 'missing-session', paymentMethod: 'Dinheiro', items: [{ productId: productA.id, quantity: 1 }] } });
  check('Venda exige caixa explícito e aberto', missingSession.status === 400, `HTTP ${missingSession.status}`);
  const foreignSale = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'foreign-sale', paymentMethod: 'Dinheiro', items: [{ productId: productB.id, quantity: 1 }] } });
  check('Venda rejeita produto de outra empresa', foreignSale.status === 404, `HTTP ${foreignSale.status}`);
  const impreciseProduct = await request('/products', { token: companyA.token, method: 'POST', body: { name: 'Preço inválido', salePrice: 10.005, stock: 3 } });
  check('Cadastro rejeita preço fora da precisão monetária', impreciseProduct.status === 400, `HTTP ${impreciseProduct.status}`);

  const saleBody = { cashSessionId: openA1.data.session.id, idempotencyKey: 'sale-once-001', paymentMethod: 'Dinheiro', items: [{ productId: productA.id, quantity: 2 }] };
  const sale1 = await request('/sales', { token: companyA.token, method: 'POST', body: saleBody, headers: { 'Idempotency-Key': saleBody.idempotencyKey } });
  const saleRetry = await request('/sales', { token: companyA.token, method: 'POST', body: saleBody, headers: { 'Idempotency-Key': saleBody.idempotencyKey } });
  check('Venda válida debita estoque uma única vez', sale1.status === 201 && saleRetry.status === 200 && sale1.data.sale.id === saleRetry.data.sale.id);
  const foreignSaleRead = await request(`/sales/${sale1.data.sale.id}`, { token: companyB.token });
  const foreignSaleCancel = await request(`/sales/${sale1.data.sale.id}/cancel`, { token: companyB.token, method: 'PATCH', body: { reason: 'teste' } });
  check('Empresa B não lê nem cancela venda da empresa A', foreignSaleRead.status === 404 && foreignSaleCancel.status === 404, `HTTP ${foreignSaleRead.status}/${foreignSaleCancel.status}`);
  const changedRetry = await request('/sales', { token: companyA.token, method: 'POST', body: { ...saleBody, items: [{ productId: productA.id, quantity: 1 }] }, headers: { 'Idempotency-Key': saleBody.idempotencyKey } });
  check('Reutilização da chave com outro conteúdo conflita', changedRetry.status === 409, `HTTP ${changedRetry.status}`);
  const concurrentBody = { cashSessionId: openA1.data.session.id, idempotencyKey: 'sale-concurrent-001', paymentMethod: 'CASH', items: [{ productId: productA.id, quantity: 1 }] };
  const concurrentRetries = await Promise.all(Array.from({ length: 8 }, () => request('/sales', { token: companyA.token, method: 'POST', body: concurrentBody, headers: { 'Idempotency-Key': concurrentBody.idempotencyKey } })));
  const concurrencyStock = await request('/products', { token: companyA.token });
  const productAStockAfterConcurrency = concurrencyStock.data.products.find((product) => product.id === productA.id)?.stock;
  check('Retries concorrentes com a mesma chave geram uma venda e uma baixa', concurrentRetries.every((result) => result.status === 200 || result.status === 201) && new Set(concurrentRetries.map((result) => result.data?.sale?.id)).size === 1 && productAStockAfterConcurrency === 2, `status=${concurrentRetries.map((result) => result.status).join(',')}; estoque=${productAStockAfterConcurrency}`);
  for (const [name, price, key] of [['Preço 10 centavos', 0.1, 'price-10c'], ['Preço 20 centavos', 0.2, 'price-20c']]) {
    const fractionalProduct = await createProduct(companyA.token, name, 2, { salePrice: price });
    const fractionalSale = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: key, paymentMethod: 'CASH', items: [{ productId: fractionalProduct.id, quantity: 1 }] } });
    check(`Venda de ${name} aceita valor em centavos`, fractionalSale.status === 201, `HTTP ${fractionalSale.status}`);
  }
  const cashPreview = await request(`/cash-sessions/${openA1.data.session.id}/preview`, { token: companyA.token });
  const cashLine = cashPreview.data.session.summary.paymentMethods.find((line) => line.method === 'CASH');
  const report = await request('/reports', { token: companyA.token });
  const cashReport = report.data.payments.find((line) => line.name === 'CASH');
  check('Resumo de caixa soma pagamentos com precisão de centavos', cashLine?.expected === 130.3 && cashLine?.sales === 4, `esperado=${cashLine?.expected}, vendas=${cashLine?.sales}`);
  check('Relatório financeiro consolida valores monetários arredondados', cashReport?.total === 30.3, `total=${cashReport?.total}`);
  const oneUnitProduct = await createProduct(companyA.token, 'Concorrência de estoque', 1);
  const oversellAttempts = await Promise.all(Array.from({ length: 8 }, (_, index) => request('/sales', {
    token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: `stock-race-${index}`, paymentMethod: 'CASH', items: [{ productId: oneUnitProduct.id, quantity: 1 }] },
  })));
  const oneUnitAfterRace = await request('/products', { token: companyA.token });
  const finalOneUnitStock = oneUnitAfterRace.data.products.find((product) => product.id === oneUnitProduct.id)?.stock;
  check('Vendas concorrentes não causam estoque negativo nem erro de servidor', oversellAttempts.filter((result) => result.status === 201).length === 1 && oversellAttempts.every((result) => result.status === 201 || result.status === 400) && finalOneUnitStock === 0, `status=${oversellAttempts.map((result) => result.status).join(',')}; estoque=${finalOneUnitStock}`);
  const stockAfterSale = await request('/products', { token: companyA.token });
  const productAStockAfterSale = stockAfterSale.data.products.find((product) => product.id === productA.id)?.stock;
  check('Estoque reflete as vendas sem duplicidade', productAStockAfterSale === 2, `estoque=${productAStockAfterSale}`);

  const lowStock = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'low-stock-001', paymentMethod: 'CASH', items: [{ productId: productA.id, quantity: 4 }] } });
  check('Venda acima do estoque é bloqueada', lowStock.status === 400, `HTTP ${lowStock.status}`);
  const backorderProduct = await createProduct(companyA.token, 'Encomenda permitida', 0, { allowBackorder: true });
  const backorderSale = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA1.data.session.id, idempotencyKey: 'backorder-allowed', paymentMethod: 'CASH', items: [{ productId: backorderProduct.id, quantity: 2 }] } });
  const backorderProducts = await request('/products', { token: companyA.token });
  check('Venda respeita configuração que permite encomenda', backorderSale.status === 201 && backorderProducts.data.products.find((product) => product.id === backorderProduct.id)?.stock === -2, `HTTP ${backorderSale.status}`);
  const cancel = await request(`/sales/${sale1.data.sale.id}/cancel`, { token: companyA.token, method: 'PATCH', body: { reason: 'Teste de cancelamento' } });
  const cancelAgain = await request(`/sales/${sale1.data.sale.id}/cancel`, { token: companyA.token, method: 'PATCH', body: { reason: 'Repetição' } });
  const stockAfterCancel = await request('/products', { token: companyA.token });
  const productAStockAfterCancel = stockAfterCancel.data.products.find((product) => product.id === productA.id)?.stock;
  check('Cancelamento preserva venda e restaura estoque', cancel.status === 200 && cancel.data.sale.status === 'CANCELLED' && productAStockAfterCancel === 4);
  check('Cancelamento repetido não restaura estoque duas vezes', cancelAgain.status === 409 && productAStockAfterCancel === 4, `HTTP ${cancelAgain.status}`);

  const concurrentClosings = await Promise.all(Array.from({ length: 8 }, () => request(`/cash-sessions/${openA2.data.session.id}/close`, { token: companyA.token, method: 'POST', body: { closingAmount: 0 } })));
  const close = concurrentClosings.find((result) => result.status === 200) || concurrentClosings[0];
  const saleClosed = await request('/sales', { token: companyA.token, method: 'POST', body: { cashSessionId: openA2.data.session.id, idempotencyKey: 'closed-register', paymentMethod: 'CASH', items: [{ productId: productA.id, quantity: 1 }] } });
  check('Caixa fecha sem movimento sem erro em requisições concorrentes', concurrentClosings.filter((result) => result.status === 200).length === 1 && concurrentClosings.every((result) => [200, 404, 409].includes(result.status)), `status=${concurrentClosings.map((result) => result.status).join(',')}`);
  check('Venda não entra em caixa fechado', saleClosed.status === 400, `HTTP ${saleClosed.status}`);
  const movementClosed = await request('/cash-movements', { token: companyA.token, method: 'POST', body: { cashSessionId: openA2.data.session.id, type: 'SUPPLY', amount: 5 } });
  check('Movimento não entra em caixa fechado', movementClosed.status === 400, `HTTP ${movementClosed.status}`);

  const orderId = `order-p0-${process.pid}`;
  const seedDb = new Database(dbPath);
  seedDb.prepare('INSERT INTO "OnlineOrder" ("id","marketId","orderNumber","customerName","paymentMethod","subtotal","discount","deliveryFee","total","createdAt","updatedAt") VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)').run(orderId, companyA.market.id, `P0-${process.pid}`, 'Cliente Teste', 'CASH', 10, 0, 0, 10);
  seedDb.prepare('INSERT INTO "OnlineOrderItem" ("id","orderId","productName","quantity","unitPrice","total","productId") VALUES (?,?,?,?,?,?,?)').run(`item-${process.pid}`, orderId, productA.name, 1, 10, 10, productA.id);
  seedDb.close();
  const skipOrder = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'DELIVERED' } });
  check('Pedido online rejeita salto de estado', skipOrder.status === 409, `HTTP ${skipOrder.status}`);
  const foreignOrder = await request(`/online-orders/${orderId}/status`, { token: companyB.token, method: 'PATCH', body: { status: 'CANCELLED' } });
  check('Empresa B não altera pedido da empresa A', foreignOrder.status === 404, `HTTP ${foreignOrder.status}`);
  const transition1 = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'CONFIRMED' } });
  const transition2 = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'PREPARING' } });
  const transition3 = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'READY' } });
  const pickupOutForDelivery = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'OUT_FOR_DELIVERY' } });
  check('Pedido para retirada não pode sair para entrega', pickupOutForDelivery.status === 409, `HTTP ${pickupOutForDelivery.status}`);
  const delivered = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'DELIVERED' } });
  const deliveredAgain = await request(`/online-orders/${orderId}/status`, { token: companyA.token, method: 'PATCH', body: { status: 'DELIVERED' } });
  const stockAfterDelivery = await request('/products', { token: companyA.token });
  const productAStockAfterDelivery = stockAfterDelivery.data.products.find((product) => product.id === productA.id)?.stock;
  check('Pedido percorre estados válidos e baixa estoque ao entregar', [transition1.status, transition2.status, transition3.status, delivered.status].every((status) => status === 200) && delivered.data.order.status === 'DELIVERED' && productAStockAfterDelivery === 3);
  check('Pedido entregue não pode baixar estoque novamente', deliveredAgain.status === 409 && productAStockAfterDelivery === 3, `HTTP ${deliveredAgain.status}`);

  const failures = results.filter((result) => !result.passed);
  console.log(`\nResultado: ${results.length - failures.length}/${results.length} passaram.`);
  if (failures.length) process.exitCode = 1;
} catch (error) {
  console.error('Falha da bateria:', error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await new Promise((resolveStop) => server.once('exit', resolveStop));
  try { const cleanup = new Database(dbPath); cleanup.close(); } catch {}
  try { (await import('node:fs/promises')).unlink(dbPath); } catch {}
}
