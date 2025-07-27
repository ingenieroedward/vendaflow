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

export interface Order {
  id: number;
  orderNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
  customer: {
    id: number;
    name: string;
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
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
  notes?: string;
}

export interface UpdateOrderRequest {
  customerId?: number;
  items?: {
    productId: number;
    quantity: number;
    unitPrice: number;
  }[];
  status?: 'pending' | 'processing' | 'completed' | 'cancelled';
  notes?: string;
}

export interface OrderFilters {
  status?: string;
  customerId?: number;
  userId?: number;
  dateFrom?: string;
  dateTo?: string;
} 