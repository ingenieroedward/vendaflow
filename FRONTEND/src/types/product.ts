export interface Category {
  id: number;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  location: string;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  name: string;
  code: string;
  unit: string;
  categoryId: number | null;
  category?: Category;
  prices?: Price[];
  salePrice: number;
  createdAt: string;
  updatedAt: string;
}

export interface Price {
  id: number;
  productId: number;
  supplierId: number;
  price: number;
  supplier?: Supplier;
  updatedByUserId: number;
  updatedByUser?: {
    id: number;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductRequest {
  name: string;
  code: string;
  unit: string;
  categoryId?: number | null;
  salePrice: number;
}

export interface CreatePriceRequest {
  productId: number;
  supplierId: number;
  price: number;
}

export interface CreateSupplierRequest {
  name: string;
  contact: string;
  location: string;
}

export interface CreateCategoryRequest {
  name: string;
  description?: string;
}