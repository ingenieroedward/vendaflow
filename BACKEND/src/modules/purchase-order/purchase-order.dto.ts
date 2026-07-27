import { z } from 'zod';

export const purchaseOrderItemSchema = z.object({
  id: z.number().positive().optional(),
  productId: z.number().positive('Product ID is required'),
  quantity: z.number().min(0.01, 'Quantity must be positive'),
  unitCost: z.number().min(0, 'Unit cost must be non-negative'),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.number().positive('Supplier ID is required'),
  poNumber: z.string().max(50).optional(),
  status: z.enum(['draft', 'ordered', 'received', 'cancelled']).default('draft'),
  notes: z.string().optional(),
  affectsStock: z.boolean().default(true),
  items: z.array(purchaseOrderItemSchema).min(1, 'At least one item is required'),
});

export const updatePurchaseOrderSchema = z.object({
  supplierId: z.number().positive().optional(),
  status: z.enum(['draft', 'ordered', 'received', 'cancelled']).optional(),
  notes: z.string().optional(),
  items: z.array(purchaseOrderItemSchema).optional(),
});

export type CreatePurchaseOrderDto = z.infer<typeof createPurchaseOrderSchema>;
export type UpdatePurchaseOrderDto = z.infer<typeof updatePurchaseOrderSchema>;

export interface PurchaseOrderItemResponseDto {
  id: number;
  productId: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  product?: { id: number; name: string; code: string; unit: string; stock: number } | undefined;
}

export interface PurchaseOrderResponseDto {
  id: number;
  poNumber: string;
  supplierId: number;
  userId: number;
  totalAmount: number;
  status: string;
  affectsStock: boolean;
  notes: string | null;
  supplier?: { id: number; name: string; contact: string; location: string } | undefined;
  user?: { id: number; username: string } | undefined;
  items: PurchaseOrderItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PurchaseOrdersListResponseDto {
  purchaseOrders: PurchaseOrderResponseDto[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
