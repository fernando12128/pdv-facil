import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { listSalesRequest, type Sale } from "../../services/salesService";

type Props = { onLogout: () => void; onNavigate: (page: AppPage) => void };
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const labels: Record<string, string> = {
  Dinheiro: "Dinheiro",
  Pix: "Pix",
  "Cartão de crédito": "Crédito",
  "Cartão de débito": "Débito",
};

export default function SalesPage({ onLogout, onNavigate }: Props) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [selected, setSelected] = useState<Sale | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    listSalesRequest().then((result) => setSales(result.sales)).catch((value) => setError(value instanceof Error ? value.message : "Erro ao carregar vendas."));
  }, []);

  return (
    <AdminLayout activePage="sales" onNavigate={onNavigate} onLogout={onLogout}>
      <div className="page-stack">
        <div className="page-heading"><div><h1>Vendas</h1><p>{sales.length} vendas</p></div></div>
        {error && <p className="feedback-error">{error}</p>}
        <section className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>Data</th><th>Cliente</th><th>Pagamento</th><th className="right">Total</th><th className="right"></th></tr></thead>
            <tbody>{sales.map((sale) => (
              <tr key={sale.id}>
                <td>{new Date(sale.createdAt).toLocaleString("pt-BR")}</td>
                <td>{sale.customerName || "-"}</td>
                <td><span className="badge">{labels[sale.paymentMethod] || sale.paymentMethod}</span></td>
                <td className="right"><strong>{brl(sale.total)}</strong></td>
                <td className="right"><button className="icon-button" onClick={() => setSelected(sale)}><Eye /></button></td>
              </tr>
            ))}</tbody>
          </table>
          {!sales.length && <div className="empty-state">Nenhuma venda ainda.</div>}
        </section>
      </div>
      {selected && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header"><h2>Detalhes da venda</h2></div>
            <div className="modal-body">
              <div className="detail-line"><span>Data:</span><span>{new Date(selected.createdAt).toLocaleString("pt-BR")}</span></div>
              <div className="detail-line"><span>Pagamento:</span><span>{labels[selected.paymentMethod] || selected.paymentMethod}</span></div>
              {selected.customerName && <div className="detail-line"><span>Cliente:</span><span>{selected.customerName}</span></div>}
              <div className="order-detail-section">
                {selected.items.map((item) => <div className="detail-line" key={item.id}><span>{item.quantity}× {item.productName}<small style={{ display: "block", color: "var(--muted-foreground)" }}>{brl(item.unitPrice)}</small></span><strong>{brl(item.total)}</strong></div>)}
              </div>
              {selected.discount > 0 && <div className="detail-line"><span>Desconto</span><span>- {brl(selected.discount)}</span></div>}
              <div className="detail-line"><strong>Total</strong><strong>{brl(selected.total)}</strong></div>
            </div>
            <div className="modal-actions"><button className="outline-button" onClick={() => setSelected(null)}>Fechar</button></div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
