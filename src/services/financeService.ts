import { apiRequest } from "./api";
const token = () => localStorage.getItem("pdv_facil_token");
export type FinancialEntry = { id: string; type: "PAYABLE" | "RECEIVABLE"; description: string; category: string; amount: number; dueDate: string; settledAt: string | null; status: "OPEN" | "SETTLED"; notes?: string | null };
export type FinanceReport = { month: string; dre: { salesRevenue: number; otherRevenue: number; expenses: number; result: number; categories: { category: string; total: number }[]; basis: string }; cashFlow: { confirmedInflows: number; confirmedOutflows: number; net: number; pendingInflows: number; pendingOutflows: number; notice: string } };
export const financeService = {
 list: () => apiRequest<{ entries: FinancialEntry[] }>("/finance/entries", { token: token() }),
 create: (data: { type: FinancialEntry["type"]; description: string; category: string; amount: number; dueDate: string; notes?: string }) => apiRequest<{ entry: FinancialEntry }>("/finance/entries", { method: "POST", token: token(), body: data }),
 settle: (id: string) => apiRequest<{ entry: FinancialEntry }>(`/finance/entries/${id}/settle`, { method: "PATCH", token: token() }),
 remove: (id: string) => apiRequest<{ message: string }>(`/finance/entries/${id}`, { method: "DELETE", token: token() }),
 report: (month: string) => apiRequest<FinanceReport>(`/finance/reports?month=${month}`, { token: token() })
};