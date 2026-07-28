import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  listOnlineOrdersRequest,
  updateOnlineOrderStatusRequest,
  type OnlineOrder,
  type OnlineOrderStatus,
} from "../../services/onlineOrdersService";
import "./ManagementPages.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const statusLabels: Record<OnlineOrderStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  PREPARING: "Em preparo",
  READY: "Pronto",
  OUT_FOR_DELIVERY: "Saiu p/ entrega",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const statusClass: Record<OnlineOrderStatus, string> = {
  PENDING: "warning",
  CONFIRMED: "info",
  PREPARING: "warning",
  READY: "success",
  OUT_FOR_DELIVERY: "info",
  DELIVERED: "success",
  CANCELLED: "danger",
};

export default function OnlineOrdersPage({ onLogout, onNavigate }: Props) {
  const [orders, setOrders] = useState<OnlineOrder[]>([]);
  const [selected, setSelected] = useState<OnlineOrder | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | OnlineOrderStatus>("ALL");
  const [error, setError] = useState("");

  async function load() {
    try {
      const response = await listOnlineOrdersRequest();
      setOrders(response.orders);
      if (selected) {
        setSelected(response.orders.find((item) => item.id === selected.id) || null);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar pedidos.");
    }
  }

  // A listagem inicial deve ocorrer uma vez; atualizações seguintes chamam load.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => orders.filter((item) => {
    const matchesSearch = `${item.orderNumber} ${item.customerName}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (status === "ALL" || item.status === status);
  }), [orders, search, status]);

  const today = new Date().toDateString();
  const todayOrders = orders.filter((item) => new Date(item.createdAt).toDateString() === today);
  const doneToday = todayOrders.filter((item) => item.status === "DELIVERED");

  async function updateStatus(next: OnlineOrderStatus) {
    if (!selected) return;
    await updateOnlineOrderStatusRequest(selected.id, next);
    await load();
  }

  function openWhatsApp() {
    if (!selected?.customerPhone) {
      setError("Sem telefone.");
      return;
    }
    const phone = selected.customerPhone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}`, "_blank", "noopener,noreferrer");
  }

  return (
    <AdminLayout activePage="online-orders" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading"><div><h1>Pedidos Online</h1><p>Acompanhe os pedidos feitos pela loja virtual</p></div></div>
        {error && <p className="feedback-error">{error}</p>}
        <div className="stats-grid">
          <article className="card stat-card"><div className="stat-card-top"><span>Pedidos hoje</span></div><strong>{todayOrders.length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Pendentes</span></div><strong>{orders.filter((item) => item.status === "PENDING").length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Em preparo</span></div><strong>{orders.filter((item) => item.status === "PREPARING").length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Concluídos hoje</span></div><strong>{doneToday.length}</strong></article>
          <article className="card stat-card"><div className="stat-card-top"><span>Faturamento online hoje</span></div><strong>{brl(doneToday.reduce((sum, item) => sum + item.total, 0))}</strong></article>
        </div>
        <section className="card">
          <div className="orders-filter-row">
            <div className="search-row"><Search /><input className="search-input" placeholder="Buscar pedido..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="ALL">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Pedido</th><th>Data</th><th>Cliente</th><th>Entrega</th><th>Pagamento</th><th>Status</th><th className="right">Total</th></tr></thead>
              <tbody>{filtered.map((item) => (
                <tr key={item.id} onClick={() => setSelected(item)} style={{ cursor: "pointer" }}>
                  <td><strong>#{item.orderNumber}</strong></td>
                  <td>{new Date(item.createdAt).toLocaleString("pt-BR")}</td>
                  <td><strong>{item.customerName}</strong><small style={{ display: "block", color: "var(--muted-foreground)" }}>{item.customerPhone}</small></td>
                  <td>{item.deliveryType === "DELIVERY" ? "Entrega" : "Retirada"}</td>
                  <td>{item.paymentMethod}</td>
                  <td><span className={`badge ${statusClass[item.status]}`}>{statusLabels[item.status]}</span></td>
                  <td className="right"><strong>{brl(item.total)}</strong></td>
                </tr>
              ))}</tbody>
            </table>
            {!filtered.length && <div className="empty-state">Nenhum pedido online ainda.</div>}
          </div>
        </section>
      </div>
      {selected && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Pedido #{selected.orderNumber}</h2>
              <p>{new Date(selected.createdAt).toLocaleString("pt-BR")}</p>
            </div>
            <div className="modal-body">
              <div className="order-detail-section">
                <strong>Cliente</strong>
                <p>{selected.customerName}<br />{selected.customerPhone}<br />{selected.customerEmail}</p>
                <button className="outline-button" onClick={openWhatsApp}><MessageCircle /> Chamar no WhatsApp</button>
              </div>
              <div className="order-detail-section"><strong>Itens</strong>{selected.items.map((item) => <div className="detail-line" key={item.id}><span>{item.quantity}× {item.productName}</span><span>{brl(item.total)}</span></div>)}</div>
              <div className="order-detail-section"><div className="detail-line"><span>Subtotal</span><span>{brl(selected.subtotal)}</span></div><div className="detail-line"><span>Desconto</span><span>- {brl(selected.discount)}</span></div><div className="detail-line"><span>Taxa</span><span>{brl(selected.deliveryFee)}</span></div><div className="detail-line"><strong>Total</strong><strong>{brl(selected.total)}</strong></div></div>
              <div className="order-status-actions">
                {(["CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"] as OnlineOrderStatus[]).map((value) => <button key={value} className={value === "CANCELLED" ? "danger-button" : "outline-button"} onClick={() => updateStatus(value)}>{statusLabels[value]}</button>)}
              </div>
            </div>
            <div className="modal-actions"><button className="outline-button" onClick={() => setSelected(null)}>Fechar</button></div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
