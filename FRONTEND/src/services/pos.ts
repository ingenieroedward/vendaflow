import { apiService } from './api';

export interface CashSession {
  id: number;
  tenantId: number;
  userId: number;
  openedAt: string;
  closedAt: string | null;
  openingAmount: number;
  expectedCash: number | null;
  countedCash: number | null;
  difference: number | null;
  status: 'open' | 'closed';
  notes: string | null;
  user?: { id: number; username: string };
}

export interface PosSaleItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface PosSaleResult {
  id: number;
  orderNumber: string;
  totalAmount: number;
}

interface Wrapped<T> { status: string; data: T }

export const posService = {
  getCurrentSession: async () =>
    (await apiService.get<Wrapped<CashSession | null>>('/pos/sessions/current')).data,
  openSession: async (openingAmount: number, notes?: string) =>
    (await apiService.post<Wrapped<CashSession>>('/pos/sessions', { openingAmount, notes })).data,
  closeSession: async (id: number, countedCash: number, notes?: string) =>
    (await apiService.patch<Wrapped<CashSession>>(`/pos/sessions/${id}/close`, { countedCash, notes })).data,
  sale: async (items: PosSaleItem[], notes?: string) =>
    (await apiService.post<Wrapped<PosSaleResult>>('/pos/sale', { items, notes })).data,
};
