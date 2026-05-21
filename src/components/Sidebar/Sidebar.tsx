import type { ReactNode } from "react";
import "./Sidebar.css";

export type AppPage =
  | "pdv"
  | "dashboard"
  | "products"
  | "sales"
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
};

const sidebarItems: SidebarItem[] = [
  {
    id: "pdv",
    label: "PDV",
    icon: <CartIcon />,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <DashboardIcon />,
  },
  {
    id: "products",
    label: "Produtos",
    icon: <BoxIcon />,
  },
  {
    id: "sales",
    label: "Vendas",
    icon: <SalesIcon />,
  },
  {
    id: "settings",
    label: "Configurações",
    icon: <GearIcon />,
  },
];

export default function Sidebar({
  activePage,
  onNavigate,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-logo-area">
        <div className="app-sidebar-logo-icon">
          <StoreIcon />
        </div>

        <strong>PDV Fácil</strong>
      </div>

      <nav className="app-sidebar-nav">
        {sidebarItems.map((item) => (
          <button
            key={item.id}
            className={`app-sidebar-link ${
              activePage === item.id ? "active" : ""
            }`}
            onClick={() => onNavigate(item.id)}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <button className="app-sidebar-logout" onClick={onLogout}>
        <LogoutIcon />
        <span>Sair</span>
      </button>
    </aside>
  );
}

function StoreIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 10.5V20H20V10.5"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 4H17.8L20 9.2C20.15 9.56 19.9 10 19.5 10H4.5C4.1 10 3.85 9.56 4 9.2L6.2 4Z"
        stroke="white"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M9 20V14H15V20"
        stroke="white"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 5H5L7.2 14.5H18.5L20 8H6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="19" r="1.4" fill="currentColor" />
      <circle cx="18" cy="19" r="1.4" fill="currentColor" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M4 7.5L12 12L20 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12 12V21" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function SalesIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <rect
        x="5"
        y="3"
        width="14"
        height="18"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M9 8H15" stroke="currentColor" strokeWidth="2" />
      <path d="M9 12H15" stroke="currentColor" strokeWidth="2" />
      <path d="M9 16H12" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8.5A3.5 3.5 0 0 0 12 15.5Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M19 12A7.8 7.8 0 0 0 18.9 10.9L21 9.3L19 5.9L16.5 6.9A8 8 0 0 0 14.6 5.8L14.2 3H10.2L9.8 5.8A8 8 0 0 0 7.9 6.9L5.4 5.9L3.4 9.3L5.5 10.9A7.8 7.8 0 0 0 5.4 12A7.8 7.8 0 0 0 5.5 13.1L3.4 14.7L5.4 18.1L7.9 17.1A8 8 0 0 0 9.8 18.2L10.2 21H14.2L14.6 18.2A8 8 0 0 0 16.5 17.1L19 18.1L21 14.7L18.9 13.1A7.8 7.8 0 0 0 19 12Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
      <path
        d="M10 5H5V19H10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M14 8L18 12L14 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18 12H9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}