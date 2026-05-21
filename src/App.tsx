import { useEffect, useState } from "react";
import AuthPage from "./pages/Auth/AuthPage";
import DashboardPage from "./pages/Dashboard/DashboardPage";
import PDVPage from "./pages/PDV/PDVPage";
import ProductsPage from "./pages/Products/ProductsPage";
import SalesPage from "./pages/Sales/SalesPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import type { AppPage } from "./components/Sidebar/Sidebar";
import { meRequest } from "./services/authService";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState<AppPage>("dashboard");
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    async function checkLoggedUser() {
      const token = localStorage.getItem("pdv_facil_token");

      if (!token) {
        setIsLoadingAuth(false);
        return;
      }

      try {
        await meRequest(token);
        setIsLoggedIn(true);
        setCurrentPage("dashboard");
      } catch {
        localStorage.removeItem("pdv_facil_token");
        setIsLoggedIn(false);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    checkLoggedUser();
  }, []);

  function handleLoginSuccess(token: string) {
    localStorage.setItem("pdv_facil_token", token);
    setIsLoggedIn(true);
    setCurrentPage("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("pdv_facil_token");
    setIsLoggedIn(false);
    setCurrentPage("dashboard");
  }

  if (isLoadingAuth) {
    return (
      <div
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f8ff",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontWeight: 700,
        }}
      >
        Carregando...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <AuthPage onLogin={handleLoginSuccess} />;
  }

  if (currentPage === "pdv") {
    return <PDVPage onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "products") {
    return <ProductsPage onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "sales") {
    return <SalesPage onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "settings") {
    return <SettingsPage onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  return <DashboardPage onLogout={handleLogout} onNavigate={setCurrentPage} />;
}