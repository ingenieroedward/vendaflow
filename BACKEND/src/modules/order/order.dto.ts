import { z } from 'zod';

// Order Item DTO
export const orderItemSchema = z.object({
  productId: z.coerce.number().positive('Product ID must be positive'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  taxRate: z.coerce.number().min(0, 'Tax rate must be non-negative'),
  unitPrice: z.coerce.number().min(0, 'Unit price must be non-negative'),
});

export type OrderItemDto = z.infer<typeof orderItemSchema>;

// Pago: contado o crédito con fecha límite y días de recordatorio
const paymentFields = {
  paymentType: z.enum(['cash', 'credit']).default('cash'),
  paymentDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)').nullish(),
  reminderDays: z.coerce.number().int().min(0).max(90).nullish(),
};

// Create Order DTO
export const createOrderSchema = z.object({
  clientRef: z.string().max(64).optional(),
  // Origen de la venta — lo fija el backend del POS, no lo envía el cliente normal de Orders
  source: z.enum(['orders', 'pos']).default('orders'),
  cashSessionId: z.number().positive().optional(),
  customerId: z.number().positive('Customer ID must be positive'),
  orderNumber: z.string().max(50, 'Order number too long').optional(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).default('pending'),
  notes: z.string().optional(),
  items: z.array(orderItemSchema).min(1, 'At least one item is required'),
  ...paymentFields,
}).refine(d => d.paymentType !== 'credit' || !!d.paymentDueDate, {
  message: 'Una orden a crédito necesita fecha límite de pago',
  path: ['paymentDueDate'],
});

export type CreateOrderDto = z.infer<typeof createOrderSchema>;

// Update Order DTO
export const updateOrderSchema = z.object({
  customerId: z.number().positive('Customer ID must be positive').optional(),
  status: z.enum(['pending', 'processing', 'completed', 'cancelled']).optional(),
  notes: z.string().optional(),
  items: z.array(orderItemSchema.partial().extend({ id: z.number().optional() })).optional(),
  paymentType: z.enum(['cash', 'credit']).optional(),
  paymentDueDate: paymentFields.paymentDueDate,
  reminderDays: paymentFields.reminderDays,
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
  paymentType: 'cash' | 'credit';
  paymentDueDate: string | null;
  reminderDays: number | null;
  paidAt: Date | null;
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