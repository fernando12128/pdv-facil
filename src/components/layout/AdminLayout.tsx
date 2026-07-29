import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import Sidebar, { type AppPage } from "../Sidebar/Sidebar";
import "./AdminLayout.css";

type AdminLayoutProps = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  children: ReactNode;
};

export default function AdminLayout({
  activePage,
  onNavigate,
  onLogout,
  children,
}: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="admin-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <section className="admin-main">
        <header className="admin-mobile-topbar">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu />
          </button>
          <strong>PDV Fácil</strong>
        </header>
        <div className="admin-content">{children}</div>
      </section>
    </main>
  );
}
