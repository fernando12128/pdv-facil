import { apiRequest } from "./api";

const token = () => localStorage.getItem("pdv_facil_token");
export type BankAccount = { id: string; name: string; bankName: string; accountType: string; lastFour: string | null; active: boolean };
export type BankTransaction = { id: string; bankAccountId: string; externalId: string; date: string; description: string; amount: number; amountCents: number; status: string; bankAccount: { name: string; bankName: string }; financialEntry: { id: string; description: string } | null };
export type RecurringRule = { id: string; description: string; category: string; type: "PAYABLE" | "RECEIVABLE"; amountCents: number; nextDueDate: string; active: boolean };
export type FinanceAuditLog = { id: string; action: string; targetType: string; targetId: string; details: string | null; createdAt: string };
const base = "/finance-ops";
export const bankingService = {
  accounts: () => apiRequest<{ accounts: BankAccount[] }>(base + "/accounts", { token: token() }),
  createAccount: (data: { name: string; bankName: string; accountType: string; lastFour?: string }) =>
    apiRequest<{ account: BankAccount }>(base + "/accounts", { method: "POST", token: token(), body: data }),
  connectors: () => apiRequest<{ providers: Array<{ id: string; label: string; status: string }>; mode: string }>(base + "/connectors", { token: token() }),
  transactions: () => apiRequest<{ transactions: BankTransaction[] }>(base + "/transactions", { token: token() }),
  importTransactions: (data: { bankAccountId: string; transactions: Array<{ date: string; description: string; amount: number; externalId?: string }> }) =>
    apiRequest<{ added: number; duplicates: number }>(base + "/transactions/import", { method: "POST", token: token(), body: data }),
  suggestions: (id: string) => apiRequest<{ suggestions: Array<{ id: string; description: string; amount: number; dueDate: string }> }>(base + `/transactions/${id}/suggestions`, { token: token() }),
  reconcile: (id: string, entryId: string) => apiRequest<{ message: string }>(base + `/transactions/${id}/reconcile`, { method: "POST", token: token(), body: { entryId } }),
  recurrences: () => apiRequest<{ rules: RecurringRule[] }>(base + "/recurrences", { token: token() }),
  createRecurrence: (data: { type: string; description: string; category: string; amount: number; nextDueDate: string }) =>
    apiRequest<{ rule: RecurringRule }>(base + "/recurrences", { method: "POST", token: token(), body: data }),
  generateRecurrences: () => apiRequest<{ generated: number }>(base + "/recurrences/generate", { method: "POST", token: token() }),
  disableRecurrence: (id: string) => apiRequest<{ message: string }>(base + `/recurrences/${id}/disable`, { method: "PATCH", token: token() }),
  audit: () => apiRequest<{ logs: FinanceAuditLog[] }>(base + "/audit", { token: token() })
};
