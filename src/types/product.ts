export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;

  isActive: boolean;

  salePrice: number;
  cost: number;
  useSameOnlinePrice: boolean;
  onlinePrice: number;

  stock: number;
  minStock: number;
  allowBackorder: boolean;

  isVisibleOnline: boolean;
  description: string;
  imageUrl: string;
  isFeatured: boolean;
  allowPickup: boolean;
  allowDelivery: boolean;
}

export interface ProductFormData {
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;

  isActive: boolean;

  salePrice: number;
  cost: number;
  useSameOnlinePrice: boolean;
  onlinePrice: number;

  stock: number;
  minStock: number;
  allowBackorder: boolean;

  isVisibleOnline: boolean;
  description: string;
  imageUrl: string;
  isFeatured: boolean;
  allowPickup: boolean;
  allowDelivery: boolean;
}