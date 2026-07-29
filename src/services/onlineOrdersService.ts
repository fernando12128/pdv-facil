import { apiRequest } from "./api";

export type OnlineOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED"
  | "CANCELLED";

export type OnlineOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerDocument?: string | null;
  deliveryType: "PICKUP" | "DELIVERY";
  address?: string | null;
  paymentMethod: string;
  status: OnlineOrderStatus;
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  note?: string | null;
  createdAt: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
};

function token() {
  return localStorage.getItem("pdv_facil_token");
}

export function listOnlineOrdersRequest() {
  return apiRequest<{ orders: OnlineOrder[] }>("/online-orders", {
    token: token(),
  });
}

export function updateOnlineOrderStatusRequest(
  id: string,
  status: OnlineOrderStatus
) {
  return apiRequest<{ order: OnlineOrder }>(`/online-orders/${id}/status`, {
    method: "PATCH",
    token: token(),
    body: { status },
  });
}
