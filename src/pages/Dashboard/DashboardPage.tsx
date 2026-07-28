import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  DollarSign,
  Globe,
  Package,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  getDashboardRequest,
  type DashboardData,
} from "../../services/dashboardService";
import "../Management/ManagementPages.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const empty: DashboardData = {
  revenueToday: 0,
  salesToday: 0,
  revenueLast7Days: 0,
  productsCount: 0,
  activeProductsCount: 0,
  lowStockCount: 0,
  onlineOrdersToday: 0,
  cashOpenedAt: null,
  chart: [],
};
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function DashboardPage({ onLogout, onNavigate }: Props) {
  const [data, setData] = useState(empty);
  const [error, setError] = useState("");
  const [renderedAt] = useState(() => Date.now());

  async function load() {
    try {
      setData(await getDashboardRequest());
    } catch (value) {
      setError(value instanceof Error ? value.message : "Erro ao carregar dashboard.");
    }
  }

  useEffect(() => { load(); }, []);
  const max = useMemo(() => Math.max(...data.chart.map((item) => item.revenue), 1), [data.chart]);
  const cashOpenTooLong = data.cashOpenedAt
    ? renderedAt - new Date(data.cashOpenedAt).getTime() > 12 * 60 * 60 * 1000
    : false;

  const stats = [
    { label: "Faturamento Hoje", value: brl(data.revenueToday), icon: DollarSign },
    { label: "Vendas Balcão", value: data.salesToday, icon: ShoppingBag },
    { label: "Pedidos Online", value: data.onlineOrdersToday, icon: Globe },
    { label: "Produtos Ativos", value: data.activeProductsCount, icon: Package },
    { label: "Estoque Baixo", value: data.lowStockCount, icon: TriangleAlert },
  ];

  return (
    <AdminLayout activePage="dashboard" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading"><div><h1>Dashboard</h1><p>Visão geral do seu negócio</p></div></div>
        {error && <p className="feedback-error">{error}</p>}
        <div className="stats-grid">
          {stats.map(({ label, value, icon: Icon }) => <article className="card stat-card" key={label}><div className="stat-card-top"><span>{label}</span><Icon /></div><strong>{value}</strong></article>)}
        </div>
        <section className="card">
          <div className="card-header"><h2>Vendas dos últimos 7 dias</h2></div>
          {data.chart.length ? (
            <div className="report-bars">
              {data.chart.map((item) => <div className="report-bar-column" key={item.label} title={`${item.salesCount} vendas · ${brl(item.revenue)}`}><div style={{ height: `${Math.max(3, (item.revenue / max) * 170)}px`, background: "var(--gradient-primary)" }} /><span>{item.label}</span></div>)}
            </div>
          ) : <div className="empty-state">Sem vendas nos últimos 7 dias.</div>}
        </section>
        {(data.lowStockCount > 0 || data.onlineOrdersToday > 0 || cashOpenTooLong) && (
          <section className="card">
            <div className="card-header"><h2 style={{ display: "flex", alignItems: "center", gap: 8 }}><Bell size={17} /> Alertas importantes</h2></div>
            <div className="card-body" style={{ display: "grid", gap: 9 }}>
              {data.lowStockCount > 0 && <button className="outline-button" style={{ justifyContent: "space-between" }} onClick={() => onNavigate("inventory")}><span>{data.lowStockCount} produto(s) com estoque baixo</span><span>Ver</span></button>}
              {data.onlineOrdersToday > 0 && <button className="outline-button" style={{ justifyContent: "space-between" }} onClick={() => onNavigate("online-orders")}><span>Pedidos online aguardando acompanhamento</span><span>Ver</span></button>}
              {cashOpenTooLong && <button className="outline-button" style={{ justifyContent: "space-between" }} onClick={() => onNavigate("pdv")}><span>Caixa aberto há mais tempo do que o normal</span><span>Ver</span></button>}
            </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
