import { useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { getReportsRequest, type ReportsData } from "../../services/reportsService";
import "./ManagementPages.css";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ReportsPage({ onLogout, onNavigate }: Props) {
  const [range, setRange] = useState<"7" | "30">("7");
  const [data, setData] = useState<ReportsData>({ daily: [], payments: [], products: [] });

  useEffect(() => { getReportsRequest(range).then(setData); }, [range]);
  const max = useMemo(() => Math.max(...data.daily.map((item) => item.total), 1), [data.daily]);

  return (
    <AdminLayout activePage="reports" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading">
          <div><h1>Relatórios</h1><p>Análise de vendas</p></div>
          <select className="search-input" style={{ width: 150 }} value={range} onChange={(e) => setRange(e.target.value as "7" | "30")}><option value="7">7 dias</option><option value="30">30 dias</option></select>
        </div>
        <section className="card">
          <div className="card-header"><h2>Faturamento por dia</h2></div>
          {data.daily.length ? (
            <div className="report-bars">{data.daily.map((item) => <div className="report-bar-column" key={item.date} title={brl(item.total)}><div style={{ height: `${Math.max(3, (item.total / max) * 160)}px` }} /><span>{new Date(`${item.date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</span></div>)}</div>
          ) : <div className="empty-state">Sem dados.</div>}
        </section>
        <div className="report-grid">
          <section className="card"><div className="card-header"><h2>Por forma de pagamento</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Forma</th><th className="right">Vendas</th><th className="right">Total</th></tr></thead><tbody>{data.payments.map((item) => <tr key={item.name}><td>{item.name}</td><td className="right">{item.count}</td><td className="right">{brl(item.total)}</td></tr>)}</tbody></table>{!data.payments.length && <div className="empty-state">Sem dados.</div>}</div></section>
          <section className="card"><div className="card-header"><h2>Top 10 produtos vendidos</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Produto</th><th className="right">Qtd</th><th className="right">Total</th></tr></thead><tbody>{data.products.map((item) => <tr key={item.name}><td><strong>{item.name}</strong></td><td className="right">{item.quantity}</td><td className="right">{brl(item.total)}</td></tr>)}</tbody></table>{!data.products.length && <div className="empty-state">Sem dados.</div>}</div></section>
        </div>
      </div>
    </AdminLayout>
  );
}
