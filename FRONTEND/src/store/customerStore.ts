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
  pendingSync: number;
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
  syncPendingCustomers: () => Promise<{ synced: number; failed: number }>;
  seedAllCustomers: () => Promise<void>;
  clearError: () => void;
  clearCurrentCustomer: () => void;
}

export const useCustomerStore = create<CustomerState>((set) => ({
  customers: [],
  currentCustomer: null,
  loading: false,
  error: null,
  pendingSync: 0,
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
      if (response.data?.length) await customerRepository.saveAllFromServer(response.data as any);
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
      try {
        const local = await db.customers.filter(c => !c.deletedAt).toArray();
        set({ customers: local.map(mapLocalToCustomer), loading: false, error: null });
      } catch {
        set({ error: error instanceof Error ? error.message : 'Error al cargar clientes', loading: false });
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
      return await customerService.searchCustomers(query);
    } catch (error: unknown) {
      try {
        const local = await db.customers
          .filter(c => !c.deletedAt && c.name.toLowerCase().includes(query.toLowerCase()))
          .toArray();
        return local.map(mapLocalToCustomer);
      } catch {
        set({ error: error instanceof Error ? error.message : 'Error al buscar clientes' });
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
      set({ currentCustomer: await customerService.getCustomerById(id), loading: false });
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al cargar cliente', loading: false });
    }
  },

  createCustomer: async (customerData: CreateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
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
          entityType: 'customer', entityLocalId: localId,
          operation: 'create', data: customerData,
          attempts: 0, createdAt: Date.now(),
        });
        const pendingSync = await db.syncQueue.count();
        const customer = mapLocalToCustomer((await db.customers.get(localId))!);
        set(state => ({ customers: [...state.customers, customer], loading: false, pendingSync }));
        return customer;
      }
      const customer = await customerService.createCustomer(customerData);
      await customerRepository.saveFromServer(customer as any);
      set(state => ({
        customers: [...state.customers, customer],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
        loading: false,
      }));
      return customer;
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al crear cliente', loading: false });
      throw error;
    }
  },

  updateCustomer: async (id: number, customerData: UpdateCustomerRequest) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.customers.where('serverId').equals(id).first()
          ?? await db.customers.get(id);
        if (!local?.id) throw new Error('Cliente no disponible sin conexión');

        await db.customers.update(local.id, {
          ...customerData,
          _syncStatus: SyncStatus.PENDING_UPDATE,
          _lastModifiedAt: Date.now(),
          updatedAt: new Date().toISOString(),
        });
        const existing = await db.syncQueue
          .where('entityLocalId').equals(local.id)
          .filter(e => e.entityType === 'customer' && e.operation === 'update')
          .first();
        if (existing?.id) {
          await db.syncQueue.update(existing.id, { data: { ...customerData, serverId: id } });
        } else {
          await db.syncQueue.add({
            entityType: 'customer', entityLocalId: local.id,
            operation: 'update', data: { ...customerData, serverId: id },
            attempts: 0, createdAt: Date.now(),
          });
        }
        const pendingSync = await db.syncQueue.count();
        set(state => ({
          customers: state.customers.map(c => c.id === id ? { ...c, ...customerData } : c),
          currentCustomer: state.currentCustomer?.id === id ? { ...state.currentCustomer, ...customerData } : state.currentCustomer,
          loading: false, pendingSync,
        }));
        return;
      }
      const updated = await customerService.updateCustomer(id, customerData);
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
      set({ error: error instanceof Error ? error.message : 'Error al actualizar cliente', loading: false });
      throw error;
    }
  },

  deleteCustomer: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.customers.where('serverId').equals(id).first()
          ?? await db.customers.get(id);
        if (local?.id) {
          if (local.serverId) {
            // Has server copy — queue deletion
            await db.customers.update(local.id, {
              _syncStatus: SyncStatus.PENDING_DELETE,
              _lastModifiedAt: Date.now(),
              deletedAt: new Date().toISOString(),
            });
            const existing = await db.syncQueue
              .where('entityLocalId').equals(local.id)
              .filter(e => e.entityType === 'customer' && e.operation === 'delete')
              .first();
            if (!existing) {
              await db.syncQueue.add({
                entityType: 'customer', entityLocalId: local.id,
                operation: 'delete', data: { serverId: local.serverId },
                attempts: 0, createdAt: Date.now(),
              });
            }
          } else {
            // Only local — delete directly
            await db.syncQueue.where('entityLocalId').equals(local.id).delete();
            await db.customers.delete(local.id);
          }
        }
        const pendingSync = await db.syncQueue.count();
        set(state => ({
          customers: state.customers.filter(c => c.id !== id),
          pagination: { ...state.pagination, total: Math.max(0, state.pagination.total - 1) },
          loading: false, pendingSync,
        }));
        return;
      }

      await customerService.deleteCustomer(id);
      const local = await db.customers.where('serverId').equals(id).first();
      if (local?.id) await db.customers.delete(local.id);
      set(state => ({
        customers: state.customers.filter(c => c.id !== id),
        pagination: { ...state.pagination, total: Math.max(0, state.pagination.total - 1) },
        loading: false,
      }));
    } catch (error: unknown) {
      set({ error: error instanceof Error ? error.message : 'Error al eliminar cliente', loading: false });
      throw error;
    }
  },

  syncPendingCustomers: async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    let synced = 0;
    let failed = 0;

    // ── PENDING_CREATE ──────────────────────────────────────────────────────
    const pendingCreates = await db.customers
      .where('_syncStatus').equals(SyncStatus.PENDING_CREATE)
      .toArray();

    for (const local of pendingCreates) {
      try {
        const created = await customerService.createCustomer({
          name: local.name, nit: local.nit ?? undefined,
          contact: local.contact ?? undefined, address: local.address ?? undefined,
          note: local.note,
        });
        await db.customers.update(local.id!, { serverId: created.id, _syncStatus: SyncStatus.SYNCED, updatedAt: created.updatedAt });
        const q = await db.syncQueue.where('entityLocalId').equals(local.id!)
          .filter(e => e.entityType === 'customer' && e.operation === 'create').first();
        if (q?.id) await db.syncQueue.delete(q.id);
        synced++;
      } catch (err) {
        const q = await db.syncQueue.where('entityLocalId').equals(local.id!)
          .filter(e => e.entityType === 'customer').first();
        if (q?.id) await db.syncQueue.update(q.id, { attempts: q.attempts + 1, lastAttemptAt: Date.now(), error: err instanceof Error ? err.message : 'Error' });
        failed++;
      }
    }

    // ── PENDING_UPDATE ──────────────────────────────────────────────────────
    const pendingUpdates = await db.customers
      .where('_syncStatus').equals(SyncStatus.PENDING_UPDATE)
      .toArray();

    for (const local of pendingUpdates) {
      try {
        const q = await db.syncQueue.where('entityLocalId').equals(local.id!)
          .filter(e => e.entityType === 'customer' && e.operation === 'update').first();
        if (!q?.data?.serverId) { failed++; continue; }
        const { serverId, ...updateData } = q.data;
        await customerService.updateCustomer(serverId, updateData);
        await db.customers.update(local.id!, { _syncStatus: SyncStatus.SYNCED });
        if (q.id) await db.syncQueue.delete(q.id);
        synced++;
      } catch (err) {
        const q = await db.syncQueue.where('entityLocalId').equals(local.id!)
          .filter(e => e.entityType === 'customer' && e.operation === 'update').first();
        if (q?.id) await db.syncQueue.update(q.id, { attempts: q.attempts + 1, lastAttemptAt: Date.now(), error: err instanceof Error ? err.message : 'Error' });
        failed++;
      }
    }

    // ── PENDING_DELETE ──────────────────────────────────────────────────────
    const pendingDeletes = await db.customers
      .where('_syncStatus').equals(SyncStatus.PENDING_DELETE)
      .toArray();

    for (const local of pendingDeletes) {
      try {
        if (!local.serverId) { failed++; continue; }
        await customerService.deleteCustomer(local.serverId);
        await db.syncQueue.where('entityLocalId').equals(local.id!).delete();
        await db.customers.delete(local.id!);
        synced++;
      } catch (err) {
        const q = await db.syncQueue
          .where('entityLocalId').equals(local.id!)
          .filter(e => e.entityType === 'customer' && e.operation === 'delete')
          .first();
        if (q?.id) {
          await db.syncQueue.update(q.id, { attempts: q.attempts + 1, lastAttemptAt: Date.now(), error: err instanceof Error ? err.message : 'Error' });
        }
        failed++;
      }
    }

    const pendingSync = await db.syncQueue
      .filter(e => e.entityType === 'customer').count();
    set({ pendingSync });

    if (synced > 0) {
      try {
        const response = await customerService.getCustomers(1, 2000);
        if (response.data?.length) await customerRepository.saveAllFromServer(response.data as any);
        set(state => ({ customers: response.data ?? state.customers }));
      } catch { /* keep local state */ }
    }

    return { synced, failed };
  },

  seedAllCustomers: async () => {
    if (!navigator.onLine) return;
    try {
      const response = await customerService.getCustomers(1, 2000);
      if (!response.data?.length) return;
      await customerRepository.saveAllFromServer(response.data as any);
    } catch { /* silent */ }
  },

  clearError: () => set({ error: null }),
  clearCurrentCustomer: () => set({ currentCustomer: null }),
}));
