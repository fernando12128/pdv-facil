import { apiRequest } from "./api";

export type Supplier = { id: string; name: string; document: string | null; phone: string | null; email: string | null };
export type PurchaseItem = {
  id: string;
  productId: string;
  quantity: number;
  unitCost: number;
  total: number;
  product: { name: string; sku: string | null };
};
export type Purchase = {
  id: string;
  reference: string | null;
  status: "DRAFT" | "RECEIVED";
  source: string;
  total: number;
  createdAt: string;
  receivedAt: string | null;
  supplier: { id: string; name: string };
  financialEntries: Array<{ id: string; dueDate: string; status: string; amountCents: number; installmentNumber: number | null; installmentCount: number | null; bankTransactionId: string | null; settledAt: string | null }>;
  items: PurchaseItem[];
};
const token = () => localStorage.getItem("pdv_facil_token");
export const purchasesService = {
  listSuppliers: () => apiRequest<{ suppliers: Supplier[] }>("/purchases/suppliers", { token: token() }),
  createSupplier: (data: { name: string; document?: string; phone?: string; email?: string }) =>
    apiRequest<{ supplier: Supplier }>("/purchases/suppliers", { method: "POST", token: token(), body: data }),
  list: () => apiRequest<{ purchases: Purchase[] }>("/purchases", { token: token() }),
  create: (data: { supplierId: string; reference?: string; dueDate: string; installmentCount?: number; items: Array<{ productId: string; quantity: number; unitCost: number }> }) =>
    apiRequest<{ purchase: Purchase }>("/purchases", { method: "POST", token: token(), body: data }),
  update: (id: string, data: { supplierId: string; reference?: string; dueDate: string; installmentCount: number; items: Array<{ productId: string; quantity: number; unitCost: number }> }) =>
    apiRequest<{ purchase: Purchase; message: string }>(`/purchases/${id}`, { method: "PUT", token: token(), body: data }),
  receive: (id: string) =>
    apiRequest<{ message: string }>(`/purchases/${id}/receive`, { method: "POST", token: token() })
};
