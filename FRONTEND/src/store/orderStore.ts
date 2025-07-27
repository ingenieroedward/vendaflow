import { create } from 'zustand';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { orderService } from '../services/orders';
import { PaginationInfo } from '../types';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  
  // Actions
  getOrders: (page?: number, limit?: number, filters?: OrderFilters) => Promise<void>;
  getOrderById: (id: number) => Promise<void>;
  createOrder: (data: CreateOrderRequest) => Promise<Order>;
  updateOrder: (id: number, data: UpdateOrderRequest) => Promise<Order>;
  deleteOrder: (id: number) => Promise<void>;
  clearError: () => void;
  clearCurrentOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },

  getOrders: async (page = 1, limit = 10, filters) => {
    set({ loading: true, error: null });
    try {
      const response = await orderService.getOrders(page, limit, filters);
      set({
        orders: response.data,
        pagination: response.pagination,
        loading: false,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  getOrderById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const order = await orderService.getOrderById(id);
      set({ currentOrder: order, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  createOrder: async (data) => {
    set({ loading: true, error: null });
    try {
      const order = await orderService.createOrder(data);
      set({ loading: false });
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await orderService.updateOrder(id, data);
      set(state => ({
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: order, // Siempre actualiza currentOrder
        loading: false,
      }));
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteOrder: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await orderService.deleteOrder(id);
      set(state => ({
        orders: state.orders.filter(o => o.id !== id),
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentOrder: () => set({ currentOrder: null }),
})); 