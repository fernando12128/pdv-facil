import { LayoutDashboard, ShoppingCart, Store } from "lucide-react";
import type { AppPage } from "../../components/Sidebar/Sidebar";
import "./HomePage.css";

type HomePageProps = {
  onNavigate: (page: AppPage) => void;
};

export default function HomePage({ onNavigate }: HomePageProps) {
  return (
    <main className="home-screen">
      <section className="home-content">
        <div className="home-title">
          <div className="home-logo">
            <Store />
          </div>
          <h1>PDV Fácil</h1>
          <p>Escolha onde quer ir</p>
        </div>

        <div className="home-options">
          <button onClick={() => onNavigate("dashboard")}>
            <LayoutDashboard />
            <strong>Painel Administrativo</strong>
            <span>Dashboard, produtos, estoque, relatórios e configurações.</span>
          </button>
          <button onClick={() => onNavigate("pdv")}>
            <ShoppingCart />
            <strong>Frente de Caixa</strong>
            <span>Vender, abrir/fechar caixa, sangria e suprimento.</span>
          </button>
        </div>
      </section>
    </main>
  );
}
