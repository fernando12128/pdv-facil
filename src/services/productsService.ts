import { apiRequest } from "./api";

export type Product = {
  id: string;
  marketId: string;

  name: string;
  sku?: string | null;
  barcode?: string | null;
  category?: string | null;
  brand?: string | null;

  isActive: boolean;

  salePrice: number;
  cost: number;
  useSameOnlinePrice: boolean;
  onlinePrice: number;

  stock: number;
  minStock: number;
  allowBackorder: boolean;

  isVisibleOnline: boolean;
  description?: string | null;
  imageUrl?: string | null;
  isFeatured: boolean;
  allowPickup: boolean;
  allowDelivery: boolean;

  createdAt: string;
  updatedAt: string;
};

export type CreateProductData = {
  name: string;
  sku?: string;
  barcode?: string;
  category?: string;
  brand?: string;

  isActive: boolean;

  salePrice: number;
  cost: number;
  useSameOnlinePrice: boolean;
  onlinePrice: number;

  stock: number;
  minStock: number;
  allowBackorder: boolean;

  isVisibleOnline: boolean;
  description?: string;
  imageUrl?: string;
  isFeatured: boolean;
  allowPickup: boolean;
  allowDelivery: boolean;
};

type ProductsResponse = {
  products: Product[];
};

type ProductResponse = {
  product: Product;
};

function getToken() {
  return localStorage.getItem("pdv_facil_token");
}

export function listProductsRequest() {
  return apiRequest<ProductsResponse>("/products", {
    method: "GET",
    token: getToken(),
  });
}

export function createProductRequest(data: CreateProductData) {
  return apiRequest<ProductResponse>("/products", {
    method: "POST",
    token: getToken(),
    body: data,
  });
}

export function updateProductRequest(id: string, data: CreateProductData) {
  return apiRequest<ProductResponse>(`/products/${id}`, {
    method: "PUT",
    token: getToken(),
    body: data,
  });
}

export function deleteProductRequest(id: string) {
  return apiRequest<{ message: string }>(`/products/${id}`, {
    method: "DELETE",
    token: getToken(),
  });
}