import type { AppPage } from "../components/Sidebar/Sidebar";

export type UserRole = "OWNER" | "MANAGER" | "CASHIER" | "STOCK";

const pageRoles: Record<AppPage, UserRole[]> = {
  home: ["OWNER", "MANAGER", "CASHIER", "STOCK"],
  pdv: ["OWNER", "MANAGER", "CASHIER"],
  dashboard: ["OWNER", "MANAGER", "STOCK"],
  products: ["OWNER", "MANAGER", "STOCK"],
  categories: ["OWNER", "MANAGER", "STOCK"],
  inventory: ["OWNER", "MANAGER", "STOCK"],
  customers: ["OWNER", "MANAGER"],
  employees: ["OWNER", "MANAGER"],
  sales: ["OWNER", "MANAGER", "CASHIER"],
  "cash-closings": ["OWNER", "MANAGER"],
  "online-orders": ["OWNER", "MANAGER"],
  payments: ["OWNER", "MANAGER"],
  reports: ["OWNER", "MANAGER", "STOCK"],
  settings: ["OWNER"],
};

export function canAccessPage(role: UserRole, page: AppPage) {
  return pageRoles[page].includes(role);
}
export function getStoredRole(): UserRole {
  const role = localStorage.getItem("pdv_facil_role");
  return role === "MANAGER" || role === "CASHIER" || role === "STOCK"
    ? role
    : "OWNER";
}
