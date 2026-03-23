import { create } from 'zustand';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { orderService } from '../services/orders';
import { PaginationInfo } from '../types';
import { db, SyncStatus, LocalOrder, LocalOrderItem } from '../database/LocalDatabase';
import { orderRepository } from '../repositories/OrderRepository';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  pendingSync: number; // órdenes pendientes de sincronizar

  // Actions
  getOrders: (page?: number, limit?: number, filters?: OrderFilters) => Promise<void>;
  getOrderById: (id: number) => Promise<void>;
  createOrder: (data: CreateOrderRequest) => Promise<Order>;
  updateOrder: (id: number, data: UpdateOrderRequest) => Promise<Order>;
  deleteOrder: (id: number) => Promise<void>;
  syncPendingOrders: () => Promise<{ synced: number; failed: number }>;
  clearError: () => void;
  clearCurrentOrder: () => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
  pendingSync: 0,

  getOrders: async (page = 1, limit = 10, filters) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        // Offline: leer de IndexedDB
        const localOrders = await db.orders
          .filter(o => !o.deletedAt)
          .reverse()
          .toArray();

        const mappedOrders: Order[] = localOrders.map(o => ({
          id: o.serverId ?? o.id!,
          orderNumber: o.orderNumber,
          customerId: o.customerId,
          userId: o.userId,
          totalAmount: o.totalAmount,
          status: o.status,
          notes: o.notes,
          createdAt: o.createdAt ?? new Date().toISOString(),
          updatedAt: o.updatedAt ?? new Date().toISOString(),
        }));

        set({
          orders: mappedOrders,
          pagination: { total: mappedOrders.length, page: 1, limit: mappedOrders.length, totalPages: 1 },
          loading: false,
          error: null,
        });
        return;
      }

      const response = await orderService.getOrders(page, limit, filters);
      set({
        orders: response.data,
        pagination: {
          total: response.pagination?.total || 0,
          page: response.pagination?.page || page,
          limit: response.pagination?.limit || limit,
          totalPages: response.pagination?.totalPages || 0,
        },
        loading: false,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar órdenes';
      set({ error: errorMessage, loading: false });
    }
  },

  getOrderById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const order = await orderService.getOrderById(id);
      set({ currentOrder: order, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar orden';
      set({ error: errorMessage, loading: false });
    }
  },

  createOrder: async (data) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        // === OFFLINE: guardar en IndexedDB ===
        const orderNumber = await orderRepository.getNextOrderNumber();

        const totalAmount = data.items.reduce((sum, item) => {
          return sum + item.quantity * item.unitPrice * (1 + item.taxRate / 100);
        }, 0);

        const localOrderData: Omit<LocalOrder, 'id'> = {
          orderNumber,
          customerId: data.customerId,
          userId: data.userId ?? 0,
          totalAmount,
          status: 'pending',
          notes: data.notes,
          _syncStatus: SyncStatus.PENDING_CREATE,
          _version: 1,
          _lastModifiedAt: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const localId = await db.orders.add(localOrderData as LocalOrder);

        // Guardar items
        const localItems: Omit<LocalOrderItem, 'id'>[] = data.items.map(item => ({
          orderId: localId,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate,
          totalPrice: item.quantity * item.unitPrice * (1 + item.taxRate / 100),
          _syncStatus: SyncStatus.PENDING_CREATE,
          _version: 1,
          _lastModifiedAt: Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

        await db.orderItems.bulkAdd(localItems as LocalOrderItem[]);

        // Agregar a cola de sincronización
        await db.syncQueue.add({
          entityType: 'order',
          entityLocalId: localId,
          operation: 'create',
          data: { ...data, orderNumber, totalAmount },
          attempts: 0,
          createdAt: Date.now(),
        });

        const pendingSync = await db.syncQueue.count();
        set({ loading: false, pendingSync });

        // Retornar orden local como si fuera del servidor
        return {
          id: localId,
          orderNumber,
          customerId: data.customerId,
          userId: data.userId ?? 0,
          totalAmount,
          status: 'pending',
          notes: data.notes,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          _isLocal: true, // flag para saber que es local
        } as unknown as Order;
      }

      // === ONLINE: flujo normal ===
      const order = await orderService.createOrder(data);
      set({ loading: false });
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear orden';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  syncPendingOrders: async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };

    const pendingItems = await db.syncQueue
      .where('entityType').equals('order')
      .filter(item => item.operation === 'create' && item.attempts < 3)
      .toArray();

    let synced = 0;
    let failed = 0;

    for (const item of pendingItems) {
      try {
        const order = await orderService.createOrder(item.data);

        // Actualizar orden local con ID del servidor
        await db.orders.update(item.entityLocalId, {
          serverId: order.id,
          orderNumber: order.orderNumber,
          _syncStatus: SyncStatus.SYNCED,
          updatedAt: order.updatedAt,
        });

        // Eliminar de la cola
        await db.syncQueue.delete(item.id!);
        synced++;
      } catch {
        await db.syncQueue.update(item.id!, {
          attempts: item.attempts + 1,
          lastAttemptAt: Date.now(),
        });
        failed++;
      }
    }

    const pendingSync = await db.syncQueue.count();
    set({ pendingSync });

    return { synced, failed };
  },

  updateOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const order = await orderService.updateOrder(id, data);
      set(state => ({
        orders: state.orders.map(o => o.id === id ? order : o),
        currentOrder: state.currentOrder?.id === id ? order : state.currentOrder,
        loading: false,
      }));
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar orden';
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
        currentOrder: state.currentOrder?.id === id ? null : state.currentOrder,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar orden';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentOrder: () => set({ currentOrder: null }),
}));
