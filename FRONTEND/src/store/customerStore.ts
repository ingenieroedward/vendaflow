import { create } from 'zustand';
import { customerService } from '../services/customers';
import { Customer, CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';
import { db, LocalCustomer, SyncStatus } from '../database/LocalDatabase';
import { customerRepository } from '../repositories/CustomerRepository';

const mapLocalToCustomer = (c: LocalCustomer): Customer => ({
  id: c.serverId ?? c.id!,
  name: c.name,
  nit: c.nit ?? null,
  contact: c.contact,
  address: c.address,
  note: c.note,
  createdAt: c.createdAt ?? new Date().toISOString(),
  updatedAt: c.updatedAt ?? new Date().toISOString(),
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

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  currentCustomer: null,
  loading: false,
  error: null,
  pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },

  getCustomers: async (page = 1, limit = 10) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.customers.filter(c => !c.deletedAt).toArray();
        const customers = local.map(mapLocalToCustomer);
        set({ customers, pagination: { page: 1, limit: customers.length, total: customers.length, totalPages: 1 }, loading: false });
        return;
      }

      const response = await customerService.getCustomers(page, limit);
      // Seed a Dexie para disponibilidad offline
      if (response.data?.length) {
        await customerRepository.saveAllFromServer(response.data as any);
      }
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
      // Fallback a Dexie si la API falla
      try {
        const local = await db.customers.filter(c => !c.deletedAt).toArray();
        const customers = local.map(mapLocalToCustomer);
        set({ customers, loading: false, error: null });
      } catch {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar clientes';
        set({ error: errorMessage, loading: false });
      }
    }
  },

  searchCustomers: async (query: string) => {
    try {
      if (!navigator.onLine) {
        const local = await db.customers
          .filter(c => !c.deletedAt && (
            c.name.toLowerCase().includes(query.toLowerCase()) ||
            (c.nit?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
            (c.contact?.toLowerCase().includes(query.toLowerCase()) ?? false)
          ))
          .toArray();
        return local.map(mapLocalToCustomer);
      }
      const customers = await customerService.searchCustomers(query);
      return customers;
    } catch (error: unknown) {
      // Fallback offline
      try {
        const local = await db.customers
          .filter(c => !c.deletedAt && c.name.toLowerCase().includes(query.toLowerCase()))
          .toArray();
        return local.map(mapLocalToCustomer);
      } catch {
        const errorMessage = error instanceof Error ? error.message : 'Error al buscar clientes';
        set({ error: errorMessage });
        throw error;
      }
    }
  },

  getCustomerById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.customers.get(id)
          ?? await db.customers.where('serverId').equals(id).first();
        if (local) { set({ currentCustomer: mapLocalToCustomer(local), loading: false }); return; }
        throw new Error('Cliente no disponible sin conexión');
      }
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
      if (!navigator.onLine) {
        // Guardar en Dexie offline
        const localId = await db.customers.add({
          name: customerData.name,
          nit: customerData.nit ?? null,
          contact: customerData.contact ?? '',
          address: customerData.address ?? '',
          note: customerData.note,
          _syncStatus: SyncStatus.PENDING_CREATE,
          _version: 1,
          _lastModifiedAt: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as LocalCustomer);
        await db.syncQueue.add({
          entityType: 'customer',
          entityLocalId: localId,
          operation: 'create',
          data: customerData,
          attempts: 0,
          createdAt: Date.now(),
        });
        const local = await db.customers.get(localId);
        const customer = mapLocalToCustomer(local!);
        set(state => ({
          customers: [...state.customers, customer],
          loading: false,
        }));
        return customer;
      }

      const customer = await customerService.createCustomer(customerData);
      // Guardar en Dexie para disponibilidad offline futura
      await customerRepository.saveFromServer(customer as any);
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
      // Actualizar en Dexie también
      const local = await db.customers.where('serverId').equals(id).first();
      if (local?.id) {
        await db.customers.update(local.id, { ...customerData, _syncStatus: SyncStatus.SYNCED, updatedAt: updated.updatedAt });
      }
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
      // Eliminar de Dexie también
      const local = await db.customers.where('serverId').equals(id).first();
      if (local?.id) await db.customers.delete(local.id);
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
