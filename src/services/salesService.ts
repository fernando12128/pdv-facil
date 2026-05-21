import { apiRequest } from "./api";

export type SaleItem = {
  id: string;
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Sale = {
  id: string;
  marketId: string;
  userId: string;
  customerName?: string | null;
  paymentMethod: string;
  discount: number;
  subtotal: number;
  total: number;
  status: "COMPLETED" | "CANCELLED";
  createdAt: string;
  updatedAt: string;
  items: SaleItem[];
};

export type CreateSaleData = {
  customerName?: string;
  paymentMethod: string;
  discount: number;
  items: {
    productId: string;
    quantity: number;
  }[];
};

type SalesResponse = {
  sales: Sale[];
};

type SaleResponse = {
  sale: Sale;
};

function getToken() {
  return localStorage.getItem("pdv_facil_token");
}

export function listSalesRequest() {
  return apiRequest<SalesResponse>("/sales", {
    method: "GET",
    token: getToken(),
  });
}

export function createSaleRequest(data: CreateSaleData) {
  return apiRequest<SaleResponse>("/sales", {
    method: "POST",
    token: getToken(),
    body: data,
  });
}

export function getSaleRequest(id: string) {
  return apiRequest<SaleResponse>(`/sales/${id}`, {
    method: "GET",
    token: getToken(),
  });
}