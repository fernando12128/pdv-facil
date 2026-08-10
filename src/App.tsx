import { useEffect, useState, type ReactNode } from "react";
import AuthPage from "./pages/Auth/AuthPage";
import HomePage from "./pages/Home/HomePage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import PDVPage from "./pages/PDV/PDVPage";
import ProductsPage from "./pages/Products/ProductsPage";
import SalesPage from "./pages/Sales/SalesPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import CategoriesPage from "./pages/Management/CategoriesPage";
import CustomersPage from "./pages/Management/CustomersPage";
import EmployeesPage from "./pages/Management/EmployeesPage";
import InventoryPage from "./pages/Management/InventoryPage";
import PaymentsPage from "./pages/Management/PaymentsPage";
import ReportsPage from "./pages/Management/ReportsPage";
import OnlineOrdersPage from "./pages/Management/OnlineOrdersPage";
import CashClosingsPage from "./pages/Management/CashClosingsPage";
import type { AppPage } from "./components/Sidebar/Sidebar";
import { meRequest } from "./services/authService";
import { canAccessPage, getStoredRole, type UserRole } from "./lib/accessControl";

const pagePaths: Record<AppPage, string> = {
  home: "/",
  pdv: "/caixa",
  dashboard: "/admin/dashboard",
  products: "/admin/produtos",
  categories: "/admin/categorias",
  inventory: "/admin/estoque",
  customers: "/admin/clientes",
  employees: "/admin/funcionarios",
  sales: "/admin/vendas",
  "cash-closings": "/admin/fechamentos",
  "online-orders": "/admin/pedidos-online",
  payments: "/admin/pagamentos",
  reports: "/admin/relatorios",
  settings: "/admin/configuracoes",
};

function pageFromPath(): AppPage {
  const entry = Object.entries(pagePaths).find(([, path]) => path === window.location.pathname);
  return (entry?.[0] as AppPage) || "home";
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>(pageFromPath);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [userRole, setUserRole] = useState<UserRole>(getStoredRole);

  useEffect(() => {
    async function checkLoggedUser() {
      const token = localStorage.getItem("pdv_facil_token");
      if (!token) {
        if (window.location.pathname !== "/auth") window.history.replaceState({}, "", "/auth");
        setIsLoadingAuth(false);
        return;
      }
      try {
        const session = await meRequest(token);
        const role = session.user.role as UserRole;
        localStorage.setItem("pdv_facil_role", role);
        setUserRole(role);
        setIsLoggedIn(true);
        if (window.location.pathname === "/auth") {
          window.history.replaceState({}, "", "/");
          setCurrentPage("home");
        }
      } catch {
        localStorage.removeItem("pdv_facil_token");
        window.history.replaceState({}, "", "/auth");
      } finally {
        setIsLoadingAuth(false);
      }
    }
    checkLoggedUser();
  }, []);

  useEffect(() => {
    const handlePopState = () => setCurrentPage(pageFromPath());
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(page: AppPage) {
    const destination = canAccessPage(userRole, page) ? page : "home";
    setCurrentPage(destination);
    window.history.pushState({}, "", pagePaths[destination]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleLoginSuccess(token: string, role: UserRole = "OWNER") {
    localStorage.setItem("pdv_facil_token", token);
    localStorage.setItem("pdv_facil_role", role);
    setUserRole(role);
    setIsLoggedIn(true);
    setCurrentPage("home");
    window.history.replaceState({}, "", "/");
  }

  function handleLogout() {
    localStorage.removeItem("pdv_facil_token");
    localStorage.removeItem("pdv_facil_role");
    setIsLoggedIn(false);
    setCurrentPage("home");
    window.history.replaceState({}, "", "/auth");
  }

  if (isLoadingAuth) return <div className="empty-state" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Carregando...</div>;
  if (!isLoggedIn) return <AuthPage onLogin={handleLoginSuccess} />;
  if (currentPage === "home" || !canAccessPage(userRole, currentPage)) {
    return <HomePage onNavigate={navigate} role={userRole} />;
  }

  const props = { onLogout: handleLogout, onNavigate: navigate };
  const pages: Record<Exclude<AppPage, "home">, ReactNode> = {
    pdv: <PDVPage {...props} />,
    dashboard: <DashboardPage {...props} />,
    products: <ProductsPage {...props} />,
    categories: <CategoriesPage {...props} />,
    inventory: <InventoryPage {...props} />,
    customers: <CustomersPage {...props} />,
    employees: <EmployeesPage {...props} />,
    sales: <SalesPage {...props} />,
    "cash-closings": <CashClosingsPage {...props} />,
    "online-orders": <OnlineOrdersPage {...props} />,
    payments: <PaymentsPage {...props} />,
    reports: <ReportsPage {...props} />,
    settings: <SettingsPage {...props} />,
  };

  return pages[currentPage as Exclude<AppPage, "home">] || <HomePage onNavigate={navigate} role={userRole} />;
}
