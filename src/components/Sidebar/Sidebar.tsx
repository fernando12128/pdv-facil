import type { ReactNode } from "react";
import {
  Boxes,
  CircleUserRound,
  CreditCard,
  FileChartColumnIncreasing,
  Globe,
  LockKeyhole,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Users,
  X,
} from "lucide-react";
import "./Sidebar.css";
import { canAccessPage, getStoredRole } from "../../lib/accessControl";

export type AppPage =
  | "home"
  | "pdv"
  | "dashboard"
  | "products"
  | "categories"
  | "inventory"
  | "customers"
  | "employees"
  | "sales"
  | "cash-closings"
  | "online-orders"
  | "payments"
  | "reports"
  | "settings";

type SidebarItem = {
  id: AppPage;
  label: string;
  icon: ReactNode;
};

type SidebarProps = {
  activePage: AppPage;
  onNavigate: (page: AppPage) => void;
  onLogout: () => void;
  open?: boolean;
  onClose?: () => void;
};

const operationItems: SidebarItem[] = [
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { id: "sales", label: "Vendas", icon: <ReceiptText /> },
  {
    id: "cash-closings",
    label: "Fechamentos de Caixa",
    icon: <LockKeyhole />,
  },
  { id: "online-orders", label: "Pedidos Online", icon: <Globe /> },
];

const registrationItems: SidebarItem[] = [
  { id: "products", label: "Produtos", icon: <Package /> },
  { id: "categories", label: "Categorias", icon: <Tags /> },
  { id: "inventory", label: "Estoque", icon: <Boxes /> },
  { id: "customers", label: "Clientes", icon: <Users /> },
  { id: "employees", label: "Funcionários", icon: <CircleUserRound /> },
];

const systemItems: SidebarItem[] = [
  { id: "payments", label: "Formas de Pagamento", icon: <CreditCard /> },
  {
    id: "reports",
    label: "Relatórios",
    icon: <FileChartColumnIncreasing />,
  },
  { id: "settings", label: "Configurações", icon: <Settings /> },
];

export default function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  open = false,
  onClose,
}: SidebarProps) {
  const role = getStoredRole();
  function navigate(page: AppPage) {
    onNavigate(page);
    onClose?.();
  }

  function renderGroup(label: string, items: SidebarItem[]) {
    const visibleItems = items.filter((item) => canAccessPage(role, item.id));
    if (!visibleItems.length) return null;

    return (
      <div className="sidebar-group">
        <span className="sidebar-group-label">{label}</span>
        {visibleItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`app-sidebar-link ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => navigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <>
      {open && <button className="sidebar-backdrop" onClick={onClose} />}
      <aside className={`app-sidebar ${open ? "mobile-open" : ""}`}>
        <div className="app-sidebar-logo-area">
          <div className="app-sidebar-logo-icon">
            <Store />
          </div>
          <div>
            <strong>PDV Fácil</strong>
            <span>Painel Administrativo</span>
          </div>
          <button className="sidebar-mobile-close" onClick={onClose}>
            <X />
          </button>
        </div>

        {canAccessPage(role, "pdv") && (
          <button
            type="button"
            className="open-cashier-button"
            onClick={() => navigate("pdv")}
          >
            <ShoppingCart />
            <span>Abrir Caixa (PDV)</span>
          </button>
        )}

        <nav className="app-sidebar-nav">
          {renderGroup("Operação", operationItems)}
          {renderGroup("Cadastros", registrationItems)}
          {renderGroup("Sistema", systemItems)}
        </nav>

        <button className="app-sidebar-logout" onClick={onLogout}>
          <LogOut />
          <span>Sair</span>
        </button>
      </aside>
    </>
  );
}
