export interface QuoteItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  totalPrice: number;
  taxRate: number;
  product: {
    id: number;
    name: string;
    code: string;
  };
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

export interface Quote {
  id: number;
  quoteNumber: string;
  customerId: number;
  userId: number;
  totalAmount: number;
  status: QuoteStatus;
  notes?: string | null;
  validUntil?: string | null;
  convertedOrderId?: number | null;
  customer: {
    id: number;
    name: string;
    code?: string | null;
    nit?: string | null;
    contact?: string;
    address?: string;
  };
  user: {
    id: number;
    username: string;
    role: string;
  };
  items: QuoteItem[];
  createdAt: string;
  updatedAt: string;
  /** presente cuando se cargó desde IndexedDB, pendiente de sincronizar */
  _isLocal?: boolean;
}

export interface CreateQuoteRequest {
  customerId: number;
  userId?: number;
  /** Clave de idempotencia: el server no crea dos cotizaciones con el mismo ref */
  clientRef?: string;
  items: {
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
  notes?: string;
  status?: QuoteStatus;
  validUntil?: string | null;
}

export interface UpdateQuoteRequest {
  customerId?: number;
  items?: {
    id?: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }[];
  status?: QuoteStatus;
  notes?: string;
  validUntil?: string | null;
}

export interface QuoteFilters {
  status?: string;
  customerId?: number;
}
