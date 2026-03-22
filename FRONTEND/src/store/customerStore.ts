import { create } from 'zustand';
import { customerService } from '../services/customers';
import { Customer, CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';

interface CustomerState {
  customers: Customer[];
  currentCustomer: Customer | null;
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  // Actions
  getCustomers: (page?: number, limit?: number) => Promise<void>;
  searchCustomers: (query: string) => Promise<Customer[]>;
  getCustomerById: (id: number) => Promise<void>;
  createCustomer: (customerData: CreateCustomerRequest) => Promise<Customer>;
  updateCustomer: (id: number, customerData: UpdateCustomerRequest) => Promise<void>;
  deleteCustomer: (id: number) => Promise<void>;
  clearError: () => void;
  clearCurrentCustomer: () => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  currentCustomer: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },

  getCustomers: async (page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const response = await customerService.getCustomers(page, limit);
      set({
        customers: response.data,
        pagination: {
          page: response.pagination?.page || page,
          limit: response.pagination?.limit || limit,
          total: response.pagination?.total || 0,
          totalPages: response.pagination?.totalPages || 0,
        },
        loading: false,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar clientes';
      set({ error: errorMessage, loading: false });
    }
  },

  searchCustomers: async (query: string) => {
    try {
      const customers = await customerService.searchCustomers(query);
      return customers;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al buscar clientes';
      set({ error: errorMessage });
      throw error;
    }
  },

  getCustomerById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const customer = await customerService.getCustomerById(id);
      set({ currentCustomer: customer, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar cliente';
      set({ error: errorMessage, loading: false });
    }
  },

  createCustomer: async (customerData: CreateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      const customer = await customerService.createCustomer(customerData);
      set(state => ({
        customers: [...state.customers, customer],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false,
      }));
      return customer;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear cliente';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateCustomer: async (id: number, customerData: UpdateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      const updated = await customerService.updateCustomer(id, customerData);
      set(state => ({
        customers: state.customers.map(c => c.id === id ? updated : c),
        currentCustomer: state.currentCustomer?.id === id ? updated : state.currentCustomer,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar cliente';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteCustomer: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await customerService.deleteCustomer(id);
      set(state => ({
        customers: state.customers.filter(c => c.id !== id),
        pagination: { ...state.pagination, total: Math.max(0, state.pagination.total - 1) },
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar cliente';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentCustomer: () => set({ currentCustomer: null }),
}));
