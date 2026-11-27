import { apiRequest } from "./api";

const token = () => localStorage.getItem("pdv_facil_token");
export type BankAccount = { id: string; name: string; bankName: string; accountType: string; lastFour: string | null; active: boolean };
export type BankTransaction = { id: string; bankAccountId: string; externalId: string; date: string; description: string; amount: number; amountCents: number; status: string; bankAccount: { name: string; bankName: string }; financialEntry: { id: string; description: string } | null };
export type RecurringRule = { id: string; description: string; category: string; type: "PAYABLE" | "RECEIVABLE"; amountCents: number; nextDueDate: string; active: boolean };
export type FinanceAuditLog = { id: string; action: string; targetType: string; targetId: string; details: string | null; createdAt: string };
export type TerminalRate = {
  id: string; paymentMethod: "CREDIT" | "DEBIT" | "PIX";
  providerName: string; feeBps: number; settlementDays: number;
  active: boolean; isDefault: boolean;
};
const base = "/finance-ops";
export const bankingService = {
  accounts: () => apiRequest<{ accounts: BankAccount[] }>(base + "/accounts", { token: token() }),
  createAccount: (data: { name: string; bankName: string; accountType: string; lastFour?: string }) =>
    apiRequest<{ account: BankAccount }>(base + "/accounts", { method: "POST", token: token(), body: data }),
  cardFees: () => apiRequest<{ rules: TerminalRate[]; estimatesEnabled: boolean }>(base + "/card-fees", { token: token() }),
  saveCardFee: (data: { paymentMethod: TerminalRate["paymentMethod"]; providerName: string; feePercent: number; settlementDays: number; isDefault?: boolean }) =>
    apiRequest<{ rule: TerminalRate }>(base + "/card-fees", { method: "PUT", token: token(), body: data }),
  setCardEstimates: (enabled: boolean) =>
    apiRequest<{ estimatesEnabled: boolean }>(base + "/card-fees/settings", { method: "PATCH", token: token(), body: { enabled } }),
  setDefaultCardFee: (id: string) =>
    apiRequest<{ message: string }>(base + `/card-fees/${encodeURIComponent(id)}/default`, { method: "PATCH", token: token() }),
  toggleCardFee: (id: string) =>
    apiRequest<{ message: string }>(base + `/card-fees/${encodeURIComponent(id)}/status`, { method: "PATCH", token: token() }),
  cardForecast: (month: string) => apiRequest<{ estimatesEnabled: boolean; forecast: Array<{ saleId: string; paymentMethod: string; provider: string | null; gross: number; fee: number | null; net: number | null; expectedAt: string | null }>; notice: string }>(base + `/card-forecast?month=${encodeURIComponent(month)}`, { token: token() }),
  connectors: () => apiRequest<{ providers: Array<{ id: string; label: string; status: string }>; mode: string }>(base + "/connectors", { token: token() }),
  transactions: () => apiRequest<{ transactions: BankTransaction[] }>(base + "/transactions", { token: token() }),
  importTransactions: (data: { bankAccountId: string; transactions: Array<{ date: string; description: string; amount: number; externalId?: string }> }) =>
    apiRequest<{ added: number; duplicates: number }>(base + "/transactions/import", { method: "POST", token: token(), body: data }),
  suggestions: (id: string) => apiRequest<{ suggestions: Array<{ id: string; description: string; amount: number; dueDate: string }> }>(base + `/transactions/${id}/suggestions`, { token: token() }),
  reconcile: (id: string, entryId: string) => apiRequest<{ message: string }>(base + `/transactions/${id}/reconcile`, { method: "POST", token: token(), body: { entryId } }),
  classify: (id: string, category: string) => apiRequest<{ entry: { id: string } }>(base + `/transactions/${id}/classify`, { method: "POST", token: token(), body: { category } }),
  saleSuggestions: (id: string) => apiRequest<{ suggestions: Array<{ id: string; createdAt: string; paymentMethod: string; gross: number; net: number; fee: number }> }>(base + `/transactions/${id}/sale-suggestions`, { token: token() }),
  reconcileSale: (id: string, saleId: string) => apiRequest<{ message: string }>(base + `/transactions/${id}/reconcile-sale`, { method: "POST", token: token(), body: { saleId } }),
  recurrences: () => apiRequest<{ rules: RecurringRule[] }>(base + "/recurrences", { token: token() }),
  createRecurrence: (data: { type: string; description: string; category: string; amount: number; nextDueDate: string }) =>
    apiRequest<{ rule: RecurringRule }>(base + "/recurrences", { method: "POST", token: token(), body: data }),
  generateRecurrences: () => apiRequest<{ generated: number }>(base + "/recurrences/generate", { method: "POST", token: token() }),
  disableRecurrence: (id: string) => apiRequest<{ message: string }>(base + `/recurrences/${id}/disable`, { method: "PATCH", token: token() }),
  audit: () => apiRequest<{ logs: FinanceAuditLog[] }>(base + "/audit", { token: token() })
};
