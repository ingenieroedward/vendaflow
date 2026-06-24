import { create } from 'zustand';
import { PurchaseOrder, CreatePurchaseOrderRequest, StockMovement, Product, PaginationInfo } from '../types';
import { purchaseOrderService } from '../services/purchaseOrders';

interface PurchaseOrderState {
  purchaseOrders: PurchaseOrder[];
  currentPurchaseOrder: PurchaseOrder | null;
  stockAlerts: Product[];
  stockMovements: StockMovement[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;

  getAll: (page?: number, limit?: number) => Promise<void>;
  getById: (id: number) => Promise<void>;
  create: (data: CreatePurchaseOrderRequest) => Promise<PurchaseOrder>;
  update: (id: number, data: Partial<CreatePurchaseOrderRequest> & { status?: string }) => Promise<PurchaseOrder>;
  markAsReceived: (id: number) => Promise<void>;
  remove: (id: number) => Promise<void>;
  fetchStockAlerts: () => Promise<void>;
  fetchStockMovements: (page?: number) => Promise<void>;
  clearError: () => void;
  clearCurrent: () => void;
}

export const usePurchaseOrderStore = create<PurchaseOrderState>((set, get) => ({
  purchaseOrders: [],
  currentPurchaseOrder: null,
  stockAlerts: [],
  stockMovements: [],
  loading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },

  getAll: async (page = 1, limit = 20) => {
    set({ loading: true, error: null });
    try {
      const response = await purchaseOrderService.getAll(page, limit);
      set({
        purchaseOrders: response.data,
        pagination: {
          total: response.pagination?.total || 0,
          page: response.pagination?.page || page,
          limit: response.pagination?.limit || limit,
          totalPages: response.pagination?.totalPages || 0,
        },
        loading: false,
      });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar órdenes de compra', loading: false });
    }
  },

  getById: async (id: number) => {
    set({ loading: true, error: null, currentPurchaseOrder: null });
    try {
      const po = await purchaseOrderService.getById(id);
      set({ currentPurchaseOrder: po, loading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar orden de compra', loading: false });
    }
  },

  create: async (data: CreatePurchaseOrderRequest) => {
    set({ loading: true, error: null });
    try {
      const po = await purchaseOrderService.create(data);
      set(state => ({ purchaseOrders: [po, ...state.purchaseOrders], loading: false }));
      return po;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al crear orden de compra', loading: false });
      throw error;
    }
  },

  update: async (id: number, data) => {
    set({ loading: true, error: null });
    try {
      const po = await purchaseOrderService.update(id, data);
      set(state => ({
        purchaseOrders: state.purchaseOrders.map(p => p.id === id ? po : p),
        currentPurchaseOrder: state.currentPurchaseOrder?.id === id ? po : state.currentPurchaseOrder,
        loading: false,
      }));
      return po;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al actualizar orden de compra', loading: false });
      throw error;
    }
  },

  markAsReceived: async (id: number) => {
    const { update, fetchStockAlerts } = get();
    await update(id, { status: 'received' });
    await fetchStockAlerts();
  },

  remove: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await purchaseOrderService.delete(id);
      set(state => ({ purchaseOrders: state.purchaseOrders.filter(p => p.id !== id), loading: false }));
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al eliminar orden de compra', loading: false });
      throw error;
    }
  },

  fetchStockAlerts: async () => {
    try {
      const response = await purchaseOrderService.getStockAlerts();
      set({ stockAlerts: response.data });
    } catch {
      // silent fail — alerts are informational
    }
  },

  fetchStockMovements: async (page = 1) => {
    try {
      const response = await purchaseOrderService.getStockMovements(page, 50);
      set({ stockMovements: response.data });
    } catch {
      // silent fail
    }
  },

  clearError: () => set({ error: null }),
  clearCurrent: () => set({ currentPurchaseOrder: null }),
}));
