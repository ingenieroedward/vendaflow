import { z } from 'zod';

// Order Item DTO
export const orderItemSchema = z.object({
  productId: z.coerce.number().positive('Product ID must be positive'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  taxRate: z.coerce.number().min(0, 'Tax rate must be non-negative'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

export type OrderItemDto = z.infer<typeof orderItemSchema>;

// Create Order DTO
export const createOrderSchema = z.object({
  customerId: z.number().positive('Customer ID must be positive'),
  orderNumber: z.string().max(50, 'Order number too long').optional(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).default('pending'),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

// Update Order DTO
export const updateOrderSchema = z.object({
  customerId: z.number().positive('Customer ID must be positive').optional(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema.partial().extend({ id: z.number().optional() })).optional(),
});

export type UpdateOrderDto = z.infer<typeof updateOrderSchema>;

// Search Order DTO
export const searchOrderSchema = z.object({
  q: z.string().min(1, 'Search query is required'),
});

export type SearchOrderDto = z.infer<typeof searchOrderSchema>;

// Order Item Response DTO
export interface OrderItemResponseDto {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  product?: {
    id: number;
    name: string;
    code: string;
    unit: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Order Response DTO
export interface OrderResponseDto {
  id: number;
  orderNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes: string | null;
  customer?: {
    id: number;
    name: string;
    contact: string | null;
    address: string | null;
  };
  user?: {
    id: number;
    username: string;
    role: string;
  };
  items?: OrderItemResponseDto[];
  createdAt: Date;
  updatedAt: Date;
}

// Orders List Response DTO
export interface OrdersListResponseDto {
  orders: OrderResponseDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} 