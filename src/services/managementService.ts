import { apiRequest } from "./api";

function token() {
  return localStorage.getItem("pdv_facil_token");
}

export type Category = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
};

export type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
  createdAt: string;
};

export type Employee = {
  id: string;
  name: string;
  role: "CASHIER" | "MANAGER";
  pin?: string | null;
  isActive: boolean;
  createdAt: string;
};

export type PaymentSetting = {
  id: string;
  type: "CASH" | "PIX" | "CREDIT" | "DEBIT";
  isEnabled: boolean;
};

export type MarketSettings = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  address?: string | null;
  owner: { name: string; email: string };
};

export const managementService = {
  categories: {
    list: () =>
      apiRequest<{ categories: Category[] }>("/management/categories", {
        token: token(),
      }),
    create: (data: { name: string; color: string }) =>
      apiRequest<{ category: Category }>("/management/categories", {
        method: "POST",
        token: token(),
        body: data,
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/management/categories/${id}`, {
        method: "DELETE",
        token: token(),
      }),
  },
  customers: {
    list: () =>
      apiRequest<{ customers: Customer[] }>("/management/customers", {
        token: token(),
      }),
    create: (data: Omit<Customer, "id" | "createdAt">) =>
      apiRequest<{ customer: Customer }>("/management/customers", {
        method: "POST",
        token: token(),
        body: data,
      }),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/management/customers/${id}`, {
        method: "DELETE",
        token: token(),
      }),
  },
  employees: {
    list: () =>
      apiRequest<{ employees: Employee[] }>("/management/employees", {
        token: token(),
      }),
    create: (data: {
      name: string;
      role: Employee["role"];
      pin: string;
      isActive: boolean;
    }) =>
      apiRequest<{ employee: Employee }>("/management/employees", {
        method: "POST",
        token: token(),
        body: data,
      }),
    toggle: (id: string) =>
      apiRequest<{ employee: Employee }>(
        `/management/employees/${id}/status`,
        { method: "PATCH", token: token() }
      ),
    remove: (id: string) =>
      apiRequest<{ message: string }>(`/management/employees/${id}`, {
        method: "DELETE",
        token: token(),
      }),
  },
  payments: {
    list: () =>
      apiRequest<{ paymentSettings: PaymentSetting[] }>(
        "/management/payment-settings",
        { token: token() }
      ),
    toggle: (type: PaymentSetting["type"], isEnabled: boolean) =>
      apiRequest<{ paymentSetting: PaymentSetting }>(
        `/management/payment-settings/${type}`,
        { method: "PATCH", token: token(), body: { isEnabled } }
      ),
  },
  market: {
    get: () =>
      apiRequest<{ market: MarketSettings }>("/management/market", {
        token: token(),
      }),
    update: (data: {
      name: string;
      ownerName: string;
      phone: string;
      address: string;
    }) =>
      apiRequest<{ market: MarketSettings }>("/management/market", {
        method: "PUT",
        token: token(),
        body: data,
      }),
  },
  stock: {
    adjust: (productId: string, adjustment: number) =>
      apiRequest<{ product: import("./productsService").Product }>(
        `/management/stock/${productId}`,
        { method: "PATCH", token: token(), body: { adjustment } }
      ),
  },
};
