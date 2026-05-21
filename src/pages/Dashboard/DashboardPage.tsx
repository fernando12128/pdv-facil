import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar/Sidebar";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import {
  getDashboardRequest,
  type DashboardData,
} from "../../services/dashboardService";
import "./DashboardPage.css";

type DashboardPageProps = {
  onLogout: () => void;
  onNavigate: (page: AppPage) => void;
};

const emptyDashboard: DashboardData = {
  revenueToday: 0,
  salesToday: 0,
  revenueLast7Days: 0,
  productsCount: 0,
  lowStockCount: 0,
  chart: [
    { label: "seg", salesCount: 0, revenue: 0 },
    { label: "ter", salesCount: 0, revenue: 0 },
    { label: "qua", salesCount: 0, revenue: 0 },
    { label: "qui", salesCount: 0, revenue: 0 },
    { label: "sex", salesCount: 0, revenue: 0 },
    { label: "sáb", salesCount: 0, revenue: 0 },
    { label: "dom", salesCount: 0, revenue: 0 },
  ],
};

export default function DashboardPage({
  onLogout,
  onNavigate,
}: DashboardPageProps) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await getDashboardRequest();

      setDashboard(response);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Erro ao carregar dashboard.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  const chartMaxValue = useMemo(() => {
    const maxSales = Math.max(
      0,
      ...dashboard.chart.map((item) => item.salesCount)
    );

    return Math.max(4, maxSales);
  }, [dashboard.chart]);

  const chartPoints = useMemo(() => {
    return dashboard.chart.map((item, index) => {
      const x = (index / 6) * 100;
      const y = 100 - (item.salesCount / chartMaxValue) * 100;

      return `${x},${y}`;
    });
  }, [dashboard.chart, chartMaxValue]);

  function formatCurrency(value: number) {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function getDotBottom(salesCount: number) {
    return `${(salesCount / chartMaxValue) * 100}%`;
  }

  return (
    <main className="dashboard-layout">
      <Sidebar
        activePage="dashboard"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <button className="topbar-button">
            <PanelIcon />
          </button>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-title-area">
            <div>
              <h1>Dashboard</h1>
              <p>Visão geral do seu negócio</p>
            </div>

            <button className="refresh-dashboard-button" onClick={loadDashboard}>
              Atualizar
            </button>
          </div>

          {errorMessage && <p className="dashboard-error">{errorMessage}</p>}

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-card-header">
                <span>Faturamento Hoje</span>
                <span className="stat-icon green">$</span>
              </div>

              <strong>
                {isLoading
                  ? "Carregando..."
                  : formatCurrency(dashboard.revenueToday)}
              </strong>
            </article>

            <article className="stat-card">
              <div className="stat-card-header">
                <span>Vendas Hoje</span>
                <span className="stat-icon blue">
                  <CalendarIcon />
                </span>
              </div>

              <strong>{isLoading ? "..." : dashboard.salesToday}</strong>
            </article>

            <article className="stat-card">
              <div className="stat-card-header">
                <span>Faturamento 7d</span>
                <span className="stat-icon blue-dollar">$</span>
              </div>

              <strong>
                {isLoading
                  ? "Carregando..."
                  : formatCurrency(dashboard.revenueLast7Days)}
              </strong>
            </article>

            <article className="stat-card">
              <div className="stat-card-header">
                <span>Produtos</span>
                <span className="stat-icon gray">
                  <SmallBoxIcon />
                </span>
              </div>

              <strong>{isLoading ? "..." : dashboard.productsCount}</strong>
            </article>

            <article className="stat-card">
              <div className="stat-card-header">
                <span>Estoque Baixo</span>
                <span className="stat-icon orange">
                  <WarningIcon />
                </span>
              </div>

              <strong>{isLoading ? "..." : dashboard.lowStockCount}</strong>
            </article>
          </section>

          <section className="chart-card">
            <h2>Vendas dos últimos 7 dias</h2>

            <div className="chart-area">
              <div className="chart-y-axis">
                <span>{chartMaxValue}</span>
                <span>{Math.round(chartMaxValue * 0.75)}</span>
                <span>{Math.round(chartMaxValue * 0.5)}</span>
                <span>{Math.round(chartMaxValue * 0.25)}</span>
                <span>0</span>
              </div>

              <div className="chart-graph">
                <div className="grid-line horizontal h1"></div>
                <div className="grid-line horizontal h2"></div>
                <div className="grid-line horizontal h3"></div>
                <div className="grid-line horizontal h4"></div>

                <div className="grid-line vertical v1"></div>
                <div className="grid-line vertical v2"></div>
                <div className="grid-line vertical v3"></div>
                <div className="grid-line vertical v4"></div>
                <div className="grid-line vertical v5"></div>
                <div className="grid-line vertical v6"></div>

                <div className="chart-baseline"></div>

                <svg className="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polyline
                    className="chart-svg-line"
                    points={chartPoints.join(" ")}
                  />
                </svg>

                {dashboard.chart.map((item, index) => {
                  const leftPositions = [
                    "0%",
                    "16.66%",
                    "33.33%",
                    "50%",
                    "66.66%",
                    "83.33%",
                    "100%",
                  ];

                  return (
                    <div
                      key={`${item.label}-${index}`}
                      className="chart-dot"
                      style={{
                        left: leftPositions[index],
                        bottom: getDotBottom(item.salesCount),
                      }}
                      title={`${item.label}: ${item.salesCount} venda(s) | ${formatCurrency(
                        item.revenue
                      )}`}
                    />
                  );
                })}

                <div className="chart-labels">
                  {dashboard.chart.map((item, index) => (
                    <span key={`${item.label}-label-${index}`}>
                      {item.label}.
                    </span>
                  ))}
                </div>
              </div>
            </div>
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

function CalendarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="5"
        width="14"
        height="15"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M8 3V7" stroke="currentColor" strokeWidth="2" />
      <path d="M16 3V7" stroke="currentColor" strokeWidth="2" />
      <path d="M5 10H19" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SmallBoxIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M4 7.5L12 12L20 7.5" stroke="currentColor" strokeWidth="2" />
      <path d="M12 12V21" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 4L21 20H3L12 4Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M12 9V14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}