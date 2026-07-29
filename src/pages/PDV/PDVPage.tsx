import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpCircle,
  Briefcase,
  ChevronDown,
  Lock,
  Printer,
  Search,
  ShoppingCart,
  Store,
  Trash2,
} from "lucide-react";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { listProductsRequest, type Product } from "../../services/productsService";
import { createSaleRequest, type Sale } from "../../services/salesService";
import { meRequest, type MeResponse } from "../../services/authService";
import {
  createCashMovementRequest,
  type CashMovementType,
} from "../../services/cashMovementsService";
import {
  closeCashSession,
  getCurrentCashSession,
  openCashSession,
  type CashSession,
} from "../../services/cashSessionsService";
import {
  managementService,
  type PaymentSetting,
} from "../../services/managementService";
import "./PDVPage.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
type CartItem = { product: Product; quantity: number };
type MovementModal = { type: CashMovementType } | null;
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const paymentLabels = {
  CASH: "Dinheiro",
  PIX: "Pix",
  CREDIT: "Cartão de crédito",
  DEBIT: "Cartão de débito",
} as const;

export default function PDVPage({ onNavigate }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [session, setSession] = useState<CashSession | null>(null);
  const [search, setSearch] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Dinheiro");
  const [discount, setDiscount] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [openingAmount, setOpeningAmount] = useState("");
  const [closingAmount, setClosingAmount] = useState("");
  const [closingOpen, setClosingOpen] = useState(false);
  const [movement, setMovement] = useState<MovementModal>(null);
  const [movementAmount, setMovementAmount] = useState("");
  const [movementNote, setMovementNote] = useState("");
  const [receipt, setReceipt] = useState<Sale | null>(null);
  const [payments, setPayments] = useState<PaymentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadProducts() {
    const response = await listProductsRequest();
    setProducts(response.products.filter((item) => item.isActive));
  }

  async function load() {
    try {
      setLoading(true);
      const token = localStorage.getItem("pdv_facil_token");
      const [current, currentUser, paymentResponse] = await Promise.all([
        getCurrentCashSession(),
        token ? meRequest(token) : Promise.resolve(null),
        managementService.payments.list(),
      ]);
      setSession(current.session);
      setUser(currentUser?.user || null);
      const enabledPayments = paymentResponse.paymentSettings.filter(
        (item) => item.isEnabled
      );
      setPayments(enabledPayments);
      if (enabledPayments.length) {
        setPaymentMethod(paymentLabels[enabledPayments[0].type]);
      }
      await loadProducts();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar o caixa.");
    } finally {
      setLoading(false);
    }
  }

  // O caixa precisa restaurar a sessão persistida apenas na entrada da tela.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => products.filter((product) =>
    `${product.name} ${product.sku || ""} ${product.barcode || ""} ${product.category || ""}`
      .toLowerCase().includes(search.toLowerCase())
  ), [products, search]);
  const subtotal = cart.reduce((sum, item) => sum + item.product.salePrice * item.quantity, 0);
  const validDiscount = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - validDiscount);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  function quantity(id: string) {
    return cart.find((item) => item.product.id === id)?.quantity || 0;
  }

  function add(product: Product) {
    setError("");
    if (
      !product.allowBackorder &&
      (product.stock <= 0 || quantity(product.id) >= product.stock)
    ) {
      setError("Estoque insuficiente.");
      return;
    }
    setCart((current) => {
      const found = current.find((item) => item.product.id === product.id);
      return found
        ? current.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
        : [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(id: string, amount: number) {
    setCart((current) => current
      .map((item) => item.product.id === id
        ? {
            ...item,
            quantity: item.product.allowBackorder
              ? item.quantity + amount
              : Math.min(item.product.stock, item.quantity + amount),
          }
        : item)
      .filter((item) => item.quantity > 0));
  }

  function clear() {
    setCart([]);
    setCustomerName("");
    setPaymentMethod(payments.length ? paymentLabels[payments[0].type] : "Dinheiro");
    setDiscount("");
    setError("");
  }

  async function openSession(event: FormEvent) {
    event.preventDefault();
    try {
      setSaving(true);
      setSession((await openCashSession({
        openingAmount: Number(openingAmount) || 0,
        operatorName: operatorName || user?.name,
      })).session);
      setSuccess("Caixa aberto.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao abrir caixa.");
    } finally {
      setSaving(false);
    }
  }

  async function closeSession(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    try {
      setSaving(true);
      await closeCashSession(session.id, Number(closingAmount));
      setSession(null);
      setClosingOpen(false);
      setClosingAmount("");
      clear();
      setSuccess("Caixa fechado.");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao fechar caixa.");
    } finally {
      setSaving(false);
    }
  }

  async function saveMovement(event: FormEvent) {
    event.preventDefault();
    if (!movement || !session) return;
    try {
      setSaving(true);
      await createCashMovementRequest({
        type: movement.type,
        amount: Number(movementAmount),
        note: movementNote,
        cashSessionId: session.id,
      });
      setSuccess(`${movement.type === "SUPPLY" ? "Suprimento" : "Sangria"} registrado.`);
      setMovement(null);
      setMovementAmount("");
      setMovementNote("");
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao registrar.");
    } finally {
      setSaving(false);
    }
  }

  async function finishSale() {
    if (!cart.length) return;
    try {
      setSaving(true);
      const response = await createSaleRequest({
        customerName,
        paymentMethod,
        discount: validDiscount,
        items: cart.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      });
      setReceipt(response.sale);
      clear();
      await loadProducts();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao finalizar venda.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="cash-closed-screen"><span>Carregando...</span></main>;

  if (!session) {
    return (
      <main className="cash-closed-screen">
        <form className="cash-open-card" onSubmit={openSession}>
          <div className="cash-open-icon"><Store /></div>
          <h1>Caixa fechado</h1>
          <p>Informe o valor inicial em dinheiro</p>
          {error && <p className="pdv-error">{error}</p>}
          {success && <p className="pdv-success">{success}</p>}
          <label>Valor inicial<input type="number" step="0.01" min="0" value={openingAmount} onChange={(e) => setOpeningAmount(e.target.value)} placeholder="0,00" /></label>
          <label>Operador (opcional)<input value={operatorName} onChange={(e) => setOperatorName(e.target.value)} placeholder="Nome do operador" /></label>
          <button type="submit" disabled={saving}>{saving ? "Abrindo..." : "Abrir Caixa"}</button>
          <button type="button" className="cash-back-link" onClick={() => onNavigate("home")}><ArrowLeft /> Voltar</button>
        </form>
      </main>
    );
  }

  return (
    <main className="pdv-screen">
      <header className="pdv-cashier-topbar">
        <div className="cashier-identity">
          <button className="cashier-icon-button" onClick={() => onNavigate("dashboard")}><ShoppingCart /></button>
          <div><h1>Frente de Caixa</h1><p>Aberto {new Date(session.openedAt).toLocaleString("pt-BR")} - {session.operatorName || user?.name || "operador"}</p></div>
        </div>
        <div className="cashier-actions">
          <button className="cashier-action-button" onClick={() => setMovement({ type: "SUPPLY" })}><ArrowDownCircle /> Suprimento</button>
          <button className="cashier-action-button" onClick={() => setMovement({ type: "WITHDRAWAL" })}><ArrowUpCircle /> Sangria</button>
          <button className="cashier-close-button" onClick={() => setClosingOpen(true)}><Lock /> Fechar Caixa</button>
          <button className="cashier-exit-button" onClick={() => onNavigate("home")}><ArrowLeft /></button>
        </div>
      </header>

      <div className="pdv-workspace">
        <section className="products-panel">
          <div className="search-box"><Search /><input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          {error && <p className="pdv-error">{error}</p>}
          {success && <p className="pdv-success">{success}</p>}
          {!products.length ? <div className="empty-products">Cadastre produtos no painel admin</div>
            : !filtered.length ? <div className="empty-products">Nenhum produto encontrado</div>
            : <div className="pdv-products-grid">{filtered.map((product) => {
              const blocked = !product.allowBackorder && (product.stock <= 0 || quantity(product.id) >= product.stock);
              return <button key={product.id} className={`pdv-product-card ${product.stock <= 0 ? "out-of-stock" : ""}`} onClick={() => add(product)} disabled={blocked}>
                <div><strong>{product.name}</strong><span>{product.category || "Sem categoria"}</span>{product.sku && <small>SKU: {product.sku}</small>}</div>
                <div className="pdv-product-bottom"><strong>{brl(product.salePrice)}</strong><span className={product.stock <= product.minStock ? "stock-warning" : ""}>{product.stock <= 0 ? "Sem estoque" : `Estoque: ${product.stock}`}</span></div>
              </button>;
            })}</div>}
        </section>

        <section className="cart-panel">
          <div className="cart-header"><div className="cart-title"><ShoppingCart /><strong>Carrinho</strong></div><span className="cart-count">{totalItems} {totalItems === 1 ? "item" : "itens"}</span></div>
          {!cart.length ? <div className="cart-empty">Adicione produtos</div> : <div className="cart-items">{cart.map((item) => <article className="cart-item" key={item.product.id}>
            <div className="cart-item-info"><strong>{item.product.name}</strong><span>{brl(item.product.salePrice)}</span></div>
            <div className="cart-item-controls"><button onClick={() => changeQuantity(item.product.id, -1)}>-</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.product.id, 1)}>+</button></div>
            <div className="cart-item-total"><strong>{brl(item.product.salePrice * item.quantity)}</strong><button onClick={() => setCart((current) => current.filter((value) => value.product.id !== item.product.id))}>remover</button></div>
          </article>)}</div>}
          <div className="cart-footer">
            <div className="cart-divider" />
            <input className="customer-input" placeholder="Cliente (opcional)" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <div className="cart-row-inputs"><label className="select-wrapper"><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{(payments.length ? payments : [{ id: "cash", type: "CASH", isEnabled: true } as PaymentSetting]).map((item) => <option key={item.type}>{paymentLabels[item.type]}</option>)}</select><ChevronDown /></label><input type="number" min="0" step="0.01" placeholder="Desc." value={discount} onChange={(e) => setDiscount(e.target.value)} /></div>
            <div className="subtotal-row"><span>Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="total-row"><strong>Total</strong><strong>{brl(total)}</strong></div>
            <div className="cart-actions"><button className="clear-button" onClick={clear}><Trash2 /> Limpar</button><button className="finish-button" disabled={!cart.length || saving} onClick={finishSale}>{saving ? "Finalizando..." : "Finalizar"}</button></div>
          </div>
        </section>
      </div>

      {movement && <div className="movement-backdrop"><form className="movement-modal" onSubmit={saveMovement}><div className="movement-modal-icon"><Briefcase /></div><h2>{movement.type === "SUPPLY" ? "Suprimento (entrada)" : "Sangria (retirada)"}</h2><p>{movement.type === "SUPPLY" ? "Registre uma entrada de dinheiro no caixa." : "Registre uma retirada de dinheiro do caixa."}</p><label>Valor<input type="number" min="0.01" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} autoFocus /></label><label>Motivo (opcional)<textarea value={movementNote} onChange={(e) => setMovementNote(e.target.value)} /></label><div className="movement-actions"><button type="button" onClick={() => setMovement(null)}>Cancelar</button><button type="submit" disabled={saving}>Confirmar</button></div></form></div>}

      {closingOpen && <div className="movement-backdrop"><form className="movement-modal" onSubmit={closeSession}><div className="movement-modal-icon"><Lock /></div><h2>Fechar Caixa</h2><p>Conte o dinheiro em caixa e informe o valor final.</p><label>Valor final<input type="number" min="0" step="0.01" value={closingAmount} onChange={(e) => setClosingAmount(e.target.value)} autoFocus /></label><div className="movement-actions"><button type="button" onClick={() => setClosingOpen(false)}>Cancelar</button><button type="submit" disabled={saving}>Confirmar</button></div></form></div>}

      {receipt && <div className="movement-backdrop"><div className="movement-modal receipt-modal"><div className="receipt-print-area"><div className="receipt-icon"><Store /></div><h2>Venda concluída</h2><p>{new Date(receipt.createdAt).toLocaleString("pt-BR")}</p>{receipt.items.map((item) => <div className="receipt-line" key={item.id}><span>{item.quantity}× {item.productName}</span><span>{brl(item.total)}</span></div>)}<div className="receipt-line receipt-total"><strong>Total</strong><strong>{brl(receipt.total)}</strong></div></div><div className="movement-actions"><button onClick={() => setReceipt(null)}>Fechar</button><button onClick={() => window.print()}><Printer /> Imprimir comprovante</button></div></div></div>}
    </main>
  );
}
