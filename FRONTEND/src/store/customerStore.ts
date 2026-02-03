import { create } from 'zustand';
import { customerService } from '../services/customers';
import { Customer, CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';
import { customerRepository } from '../repositories/CustomerRepository';
import { LocalCustomer } from '../database/LocalDatabase';
import { CreateCustomerDTO } from '../database/models';
import { useAuthStore } from './authStore';

// Helper to convert LocalCustomer to Customer type
const toCustomer = (local: LocalCustomer): Customer => ({
  id: local.id!,
  name: local.name,
  contact: local.contact,
  address: local.address,
  note: local.note,
  createdAt: local.createdAt || new Date().toISOString(),
  updatedAt: local.updatedAt || new Date().toISOString(),
  deletedAt: local.deletedAt
});

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
      const userId = useAuthStore.getState().user?.id;

      // Get from local DB first
      let localCustomers = await customerRepository.getAllSortedByName();

      // If empty, try to sync from server
      if (localCustomers.length === 0 && navigator.onLine) {
        try {
          const response = await customerService.getCustomers(1, 1000);
          // Save all customers from server to local DB
          for (const serverCustomer of response.data) {
            await customerRepository.saveFromServer(serverCustomer, userId);
          }
          // Re-fetch from local DB after sync
          localCustomers = await customerRepository.getAllSortedByName();
        } catch (syncError) {
          console.log('Server sync failed, using local data:', syncError);
        }
      }

      // Client-side pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedCustomers = localCustomers.slice(startIndex, endIndex);

      set({
        customers: paginatedCustomers.map(toCustomer),
        pagination: {
          page,
          limit,
          total: localCustomers.length,
          totalPages: Math.ceil(localCustomers.length / limit),
        },
        loading: false,
      });
    } catch (error: unknown) {
      let errorMessage = 'Error al cargar clientes';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      set({ error: errorMessage, loading: false });
    }
  },

  searchCustomers: async (query: string) => {
    try {
      const localCustomers = await customerRepository.search(query);
      return localCustomers.map(toCustomer);
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
      const localCustomer = await customerRepository.getById(id);
      if (localCustomer) {
        set({ currentCustomer: toCustomer(localCustomer), loading: false });
      } else {
        set({ error: 'Cliente no encontrado', loading: false });
      }
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
      const userId = useAuthStore.getState().user?.id;

      const customerDTO: CreateCustomerDTO = {
        name: customerData.name,
        contact: customerData.contact || '',
        address: customerData.address || '',
        note: customerData.note
      };

      const localCustomer = await customerRepository.createLocal(customerDTO, userId);
      const newCustomer = toCustomer(localCustomer);

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
      let errorMessage = 'Error al crear cliente';

      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateCustomer: async (id: number, customerData: UpdateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;

      const localCustomer = await customerRepository.updateLocal(id, customerData, userId);
      const updatedCustomer = toCustomer(localCustomer);

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
      const userId = useAuthStore.getState().user?.id;
      await customerRepository.deleteLocal(id, userId);

      set(state => ({
        customers: state.customers.filter(customer => customer.id !== id),
        pagination: {
          ...state.pagination,
          total: Math.max(0, state.pagination.total - 1),
        },
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