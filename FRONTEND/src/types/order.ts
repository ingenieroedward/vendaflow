export interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  totalPrice:number;
  taxRate:number;
  product: {
    id: number;
    name: string;
    code: string;
  };
}

export type PaymentType = 'cash' | 'credit';

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  paymentType?: PaymentType;
  paymentDueDate?: string | null;
  reminderDays?: number | null;
  paidAt?: string | null;
  customer: {
    id: number;
    name: string;
    nit?: string | null;
    contact?: string;
    address?: string;
    note?: string;
  };
  user: {
    id: number;
    username: string;
    role: string;
  };
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderRequest {
  customerId: number;
  userId?: number;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
  notes?: string;
  paymentType?: PaymentType;
  paymentDueDate?: string | null;
  reminderDays?: number | null;
}

export interface UpdateOrderRequest {
  customerId?: number;
  userId?: number;
  items?: {
    id?: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  paymentType?: PaymentType;
  paymentDueDate?: string | null;
  reminderDays?: number | null;
}

export interface OrderFilters {
  status?: string;
  customerId?: number;
  userId?: number;
  dateFrom?: string;
  dateTo?: string;
} 