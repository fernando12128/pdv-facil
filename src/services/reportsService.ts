import { apiRequest } from "./api";

export type ReportsData = {
  daily: { date: string; sales: number; total: number }[];
  payments: { name: string; count: number; total: number }[];
  products: { name: string; quantity: number; total: number }[];
};

export function getReportsRequest(range: "7" | "30") {
  return apiRequest<ReportsData>(`/reports?range=${range}`, {
    token: localStorage.getItem("pdv_facil_token"),
  });
}
