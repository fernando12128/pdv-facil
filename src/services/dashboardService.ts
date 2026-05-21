import { apiRequest } from "./api";

export type DashboardChartItem = {
  label: string;
  salesCount: number;
  revenue: number;
};

export type DashboardData = {
  revenueToday: number;
  salesToday: number;
  revenueLast7Days: number;
  productsCount: number;
  lowStockCount: number;
  chart: DashboardChartItem[];
};

function getToken() {
  return localStorage.getItem("pdv_facil_token");
}

export function getDashboardRequest() {
  return apiRequest<DashboardData>("/dashboard", {
    method: "GET",
    token: getToken(),
  });
}