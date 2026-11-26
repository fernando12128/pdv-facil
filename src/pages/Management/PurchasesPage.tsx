import { useEffect, useMemo, useState } from "react";
import { Plus, PackageCheck, ClipboardList, Truck } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { listProductsRequest, type Product } from "../../services/productsService";
import { purchasesService, type Purchase, type Supplier } from "../../services/purchasesService";
import "./ManagementPages.css";
import "./PurchasesPage.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
type Line = { productId: string; quantity: string; unitCost: string };
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const emptyLine = (): Line => ({ productId: "", quantity: "1", unitCost: "0" });
const today = () => new Date().toLocaleDateString("en-CA");

export default function PurchasesPage({ onLogout, onNavigate }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierModal, setSupplierModal] = useState(false);
  const [purchaseModal, setPurchaseModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", document: "", phone: "", email: "" });
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [dueDate, setDueDate] = useState(today);
  const [installmentCount, setInstallmentCount] = useState(1);
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [supplierData, productData, purchaseData] = await Promise.all([
      purchasesService.listSuppliers(), listProductsRequest(), purchasesService.list()
    ]);
    setSuppliers(supplierData.suppliers);
    setProducts(productData.products);
    setPurchases(purchaseData.purchases);
  }
  useEffect(() => {
    load().catch(e => setError(e instanceof Error ? e.message : "Erro ao carregar compras."));
  }, []);
  const total = useMemo(() => lines.reduce((sum, row) =>
    sum + (Number(row.quantity) || 0) * (Number(row.unitCost) || 0), 0), [lines]);
  const received = purchases.filter(item => item.status === "RECEIVED");
  const pending = purchases.filter(item => item.status === "DRAFT");

  async function saveSupplier() {
    if (!supplierForm.name.trim()) return setError("Informe o nome do fornecedor.");
    setBusy(true); setError(""); setMessage("");
    try {
      await purchasesService.createSupplier(supplierForm);
      await load();
      setSupplierModal(false);
      setSupplierForm({ name: "", document: "", phone: "", email: "" });
      setMessage("Fornecedor cadastrado.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar fornecedor."); }
    finally { setBusy(false); }
  }

  async function savePurchase() {
    const items = lines.map(line => ({ productId: line.productId, quantity: Number(line.quantity), unitCost: Number(line.unitCost) }));
    if (!supplierId || !items.length || items.some(i => !i.productId || !Number.isSafeInteger(i.quantity) || i.quantity <= 0 ||
      !Number.isFinite(i.unitCost) || i.unitCost < 0 || !Number.isSafeInteger(Math.round(i.unitCost * 100)) ||
      Math.abs(i.unitCost * 100 - Math.round(i.unitCost * 100)) > 1e-6) ||
      new Set(items.map(i => i.productId)).size !== items.length) {
      return setError("Selecione fornecedor e produtos diferentes, com quantidade e custo válidos.");
    }
    if (!Number.isSafeInteger(installmentCount) || installmentCount < 1 || installmentCount > 36) return setError("Informe entre 1 e 36 parcelas.");
    setBusy(true); setError(""); setMessage("");
    try {
      await purchasesService.create({ supplierId, reference, dueDate, installmentCount, items });
      await load();
      setPurchaseModal(false);
      setSupplierId(""); setReference(""); setDueDate(today()); setInstallmentCount(1); setLines([emptyLine()]);
      setMessage("Romaneio salvo e conta a pagar criada automaticamente no Financeiro. Confirme a mercadoria ao receber.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao salvar compra."); }
    finally { setBusy(false); }
  }

  async function receive(purchase: Purchase) {
    if (!window.confirm(`Confirma o recebimento da compra de ${purchase.supplier.name}? O estoque e custo médio serão atualizados.`)) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await purchasesService.receive(purchase.id);
      await load();
      setMessage("Recebimento confirmado. Estoque e custos atualizados.");
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao confirmar entrada."); }
    finally { setBusy(false); }
  }

  function updateLine(index: number, value: Partial<Line>) {
    setLines(current => current.map((line, i) => i === index ? { ...line, ...value } : line));
  }

  return <AdminLayout activePage="purchases" onNavigate={onNavigate} onLogout={onLogout}>
    <div className="page-stack">
      <div className="page-heading">
        <div><h1>Compras</h1><p>Fornecedores, romaneios e entrada de mercadorias</p></div>
        <div className="purchases-heading-actions">
          <button className="outline-button" onClick={() => setSupplierModal(true)}><Truck /> Fornecedor</button>
          <button className="primary-button" onClick={() => { setError(""); setPurchaseModal(true); }}><Plus /> Nova compra</button>
        </div>
      </div>
      {error && <p className="feedback-error" role="alert">{error}</p>}
      {message && <p className="feedback-success" role="status">{message}</p>}
      <div className="stats-grid purchases-stats">
        <article className="card stat-card"><div className="stat-card-top"><span>Fornecedores</span><Truck /></div><strong>{suppliers.length}</strong></article>
        <article className="card stat-card"><div className="stat-card-top"><span>Aguardando recebimento</span><ClipboardList /></div><strong>{pending.length}</strong></article>
        <article className="card stat-card"><div className="stat-card-top"><span>Compras recebidas</span><PackageCheck /></div><strong>{received.length}</strong></article>
        <article className="card stat-card"><div className="stat-card-top"><span>Total recebido</span></div><strong>{brl(received.reduce((s, p) => s + p.total, 0))}</strong></article>
      </div>
      <div className="card">
        <div className="card-header"><h2>Histórico de compras</h2></div>
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Data</th><th>Fornecedor</th><th>Referência</th><th>Itens</th><th className="right">Total</th><th>Situação</th><th className="right">Ação</th></tr></thead>
          <tbody>{purchases.map(p => <tr key={p.id}>
            <td>{new Date(p.createdAt).toLocaleDateString("pt-BR")}</td>
            <td><strong>{p.supplier.name}</strong></td>
            <td>{p.reference || "Romaneio"}</td>
            <td><details><summary>{p.items.length} produto(s)</summary><div className="purchases-detail">
              {p.items.map(i => <div key={i.id}>{i.product.name}: {i.quantity} × {brl(i.unitCost)}</div>)}
            </div></details></td>
            <td className="right">{brl(p.total)}</td>
            <td><span className={`badge ${p.status === "RECEIVED" ? "success" : "warning"}`}>{p.status === "RECEIVED" ? "Recebida" : "Pendente"}</span></td>
            <td className="right">{p.status === "DRAFT" && <button disabled={busy} className="outline-button" onClick={() => receive(p)}>Receber</button>}</td>
          </tr>)}</tbody>
        </table>{!purchases.length && <div className="empty-state">Nenhuma compra registrada.</div>}</div>
      </div>
      <div className="card card-body"><strong>Importação de NF-e / SEFAZ</strong>
        <p className="purchases-note">A integração fiscal automática ainda não está disponível nesta etapa. Cadastre a entrada pelo romaneio. Não há consulta à SEFAZ ativa.</p>
      </div>
    </div>

    {supplierModal && <div className="modal-backdrop"><div className="modal-card">
      <div className="modal-header"><h2>Novo fornecedor</h2></div>
      <div className="modal-body form-grid">
        {(["name", "document", "phone", "email"] as const).map(key =>
          <div className="field" key={key}><label>{{ name: "Nome", document: "CNPJ/CPF", phone: "Telefone", email: "E-mail" }[key]}</label>
            <input value={supplierForm[key]} onChange={e => setSupplierForm({ ...supplierForm, [key]: e.target.value })} /></div>)}
      </div>
      <div className="modal-actions"><button className="outline-button" disabled={busy} onClick={() => setSupplierModal(false)}>Cancelar</button>
        <button className="primary-button" disabled={busy} onClick={saveSupplier}>Salvar fornecedor</button></div>
    </div></div>}

    {purchaseModal && <div className="modal-backdrop"><div className="modal-card wide">
      <div className="modal-header"><h2>Nova compra / Romaneio</h2><p>Registre a compra e depois confirme o recebimento das mercadorias.</p></div>
      <div className="modal-body">
        <div className="form-grid">
          <div className="field"><label>Fornecedor</label><select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
            <option value="">Selecione</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></div>
          <div className="field"><label>Nº do pedido / Romaneio</label><input maxLength={100} value={reference} onChange={e => setReference(e.target.value)} /></div>
          <div className="field"><label>Vencimento da conta a pagar</label><input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></div>
          <div className="field"><label>Quantidade de parcelas</label><input type="number" min="1" max="36" step="1" value={installmentCount} onChange={e => setInstallmentCount(Number(e.target.value))} /></div>
        </div>
        <div className="purchases-lines">
          {lines.map((line, index) => <div className="purchases-line" key={index}>
            <div className="field"><label>Produto</label><select value={line.productId} onChange={e => {
              const item = products.find(p => p.id === e.target.value);
              updateLine(index, { productId: e.target.value, unitCost: String(item?.cost ?? 0) });
            }}><option value="">Selecione</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label>Qtd.</label><input type="number" min="1" step="1" value={line.quantity} onChange={e => updateLine(index, { quantity: e.target.value })} /></div>
            <div className="field"><label>Custo unitário</label><input type="number" min="0" step="0.01" value={line.unitCost} onChange={e => updateLine(index, { unitCost: e.target.value })} /></div>
            <button className="outline-button" type="button" aria-label="Remover linha" disabled={lines.length === 1} onClick={() => setLines(current => current.filter((_, i) => i !== index))}>×</button>
          </div>)}
        </div>
        <button className="outline-button" onClick={() => setLines(current => [...current, emptyLine()])}><Plus /> Adicionar produto</button>
        <p className="purchases-note">Ao salvar, uma conta a pagar será criada automaticamente no Financeiro, mesmo antes de receber a mercadoria.</p>
        <p className="purchases-total">Total da compra: <strong>{brl(total)}</strong></p>
      </div>
      <div className="modal-actions"><button className="outline-button" disabled={busy} onClick={() => setPurchaseModal(false)}>Cancelar</button>
        <button className="primary-button" disabled={busy} onClick={savePurchase}>Salvar romaneio</button></div>
    </div></div>}
  </AdminLayout>;
}
