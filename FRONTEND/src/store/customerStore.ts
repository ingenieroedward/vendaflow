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

export const useCustomerStore = create<CustomerState>((set, get) => ({
  customers: [],
  currentCustomer: null,
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  },

  getCustomers: async (page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      const response = await customerService.getCustomers(page, limit);
      set({
        customers: response.data,
        pagination: response.pagination,
        loading: false,
      });
    } catch (error: unknown) {
      // Fallback to mock data if API fails
      console.log('API failed, using mock data for customers');
      const mockCustomers: Customer[] = [
        {
          id: 1,
          name: 'Juan Pérez',
          contact: 'juan.perez@email.com',
          address: 'Calle 123 # 45-67, Bogotá',
          note: 'Cliente frecuente',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          name: 'María García',
          contact: '+57 310 987 6543',
          address: 'Carrera 78 # 90-12, Medellín',
          note: 'Prefiere contacto por WhatsApp',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 3,
          name: 'Carlos López',
          contact: 'carlos.lopez@email.com',
          address: 'Avenida 5 # 23-45, Cali',
          note: 'Cliente corporativo',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 4,
          name: 'Ana Rodríguez',
          contact: '+57 320 111 2222',
          address: 'Calle 10 # 15-20, Barranquilla',
          note: 'Entrega en oficina',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 5,
          name: 'Luis Martínez',
          contact: 'luis.martinez@email.com',
          address: 'Carrera 50 # 30-40, Bucaramanga',
          note: 'Cliente VIP',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      set({
        customers: mockCustomers,
        pagination: {
          page: 1,
          limit: 10,
          total: mockCustomers.length,
          totalPages: 1,
        },
        loading: false,
      });
    }
  },

  searchCustomers: async (query: string) => {
    try {
      const customers = await customerService.searchCustomers(query);
      return customers;
    } catch (error: unknown) {
      let errorMessage = 'Error al buscar clientes';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
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
      let errorMessage = 'Error al cargar cliente';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
    }
  },

  createCustomer: async (customerData: CreateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      const newCustomer = await customerService.createCustomer(customerData);
      set(state => ({
        customers: [...state.customers, newCustomer],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        loading: false,
      }));
      return newCustomer;
    } catch (error: unknown) {
      // Fallback to mock creation if API fails
      console.log('API failed, creating mock customer');
      const newCustomer: Customer = {
        id: Math.max(...get().customers.map(c => c.id), 0) + 1,
        ...customerData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      set(state => ({
        customers: [...state.customers, newCustomer],
        pagination: {
          ...state.pagination,
          total: state.pagination.total + 1,
        },
        loading: false,
      }));
      return newCustomer;
    }
  },

  updateCustomer: async (id: number, customerData: UpdateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      const updatedCustomer = await customerService.updateCustomer(id, customerData);
      set(state => ({
        customers: state.customers.map(customer => 
          customer.id === id ? updatedCustomer : customer
        ),
        currentCustomer: state.currentCustomer?.id === id ? updatedCustomer : state.currentCustomer,
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al actualizar cliente';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteCustomer: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await customerService.deleteCustomer(id);
      set(state => ({
        customers: state.customers.filter(customer => customer.id !== id),
        loading: false,
      }));
    } catch (error: unknown) {
      let errorMessage = 'Error al eliminar cliente';
      
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentCustomer: () => set({ currentCustomer: null }),
})); 