import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import { listSalesRequest, type Sale } from "../../services/salesService";
import "./SalesPage.css";

type SalesPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

export default function SalesPage({ onLogout, onNavigate }: SalesPageProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await listSalesRequest();

      setSales(response.sales);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao carregar vendas.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function formatDate(date: string) {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(date));
  }

  return (
    <main className="sales-layout">
      <Sidebar activePage="sales" onNavigate={onNavigate} onLogout={onLogout} />

      <section className="sales-main">
        <header className="sales-topbar">
          <button className="sales-topbar-button">
            <PanelIcon />
          </button>
        </header>

        <div className="sales-content">
          <div className="sales-title-area">
            <h1>Vendas</h1>
            <p>
              {sales.length}{" "}
              {sales.length === 1 ? "venda registrada" : "vendas registradas"}
            </p>
          </div>

          {errorMessage && <p className="sales-error">{errorMessage}</p>}

          <section className="sales-table-card">
            <div className="sales-table-header">
              <span>Data</span>
              <span>Cliente</span>
              <span>Pagamento</span>
              <span>Total</span>
            </div>

            {isLoading ? (
              <div className="sales-empty-row">Carregando vendas...</div>
            ) : sales.length === 0 ? (
              <div className="sales-empty-row">Nenhuma venda ainda.</div>
            ) : (
              <div className="sales-list">
                {sales.map((sale) => (
                  <div className="sales-table-row" key={sale.id}>
                    <span>{formatDate(sale.createdAt)}</span>
                    <span>{sale.customerName || "-"}</span>
                    <span>{sale.paymentMethod}</span>
                    <strong>{formatCurrency(sale.total)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}

function PanelIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M10 5V19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}