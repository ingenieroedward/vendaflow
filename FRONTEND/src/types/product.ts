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
  stock: number;
  minStock: number;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseOrderItem {
  id?: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost?: number;
  product?: Pick<Product, 'id' | 'name' | 'code' | 'unit' | 'stock'>;
}

export type PurchaseOrderStatus = 'draft' | 'ordered' | 'received' | 'cancelled';

export interface PurchaseOrder {
  id: number;
  poNumber: string;
  supplierId: number;
  userId: number;
  totalAmount: number;
  status: PurchaseOrderStatus;
  notes: string | null;
  affectsStock?: boolean;
  supplier?: Supplier;
  user?: { id: number; username: string };
  items: PurchaseOrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseOrderRequest {
  supplierId: number;
  status?: PurchaseOrderStatus;
  notes?: string;
  affectsStock?: boolean;
  items: Array<{ productId: number; quantity: number; unitCost: number }>;
}

export interface StockMovement {
  id: number;
  productId: number;
  type: 'sale' | 'purchase' | 'adjustment';
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  referenceId: number | null;
  referenceType: 'order' | 'purchase_order' | 'adjustment' | null;
  userId: number;
  notes: string | null;
  product?: Pick<Product, 'id' | 'name' | 'code' | 'unit'>;
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
  stock?: number;
  minStock?: number;
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