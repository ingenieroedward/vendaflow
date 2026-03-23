import { create } from 'zustand';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { orderService } from '../services/orders';
import { PaginationInfo } from '../types';
import { db, SyncStatus, LocalOrder, LocalOrderItem } from '../database/LocalDatabase';
import { orderRepository } from '../repositories/OrderRepository';

// ─── Helpers para cargar desde IndexedDB ────────────────────────────────────

async function loadOrdersFromLocal(): Promise<Order[]> {
  const localOrders = await db.orders.filter(o => !o.deletedAt).reverse().toArray();
  return Promise.all(localOrders.map(o => mapLocalOrder(o)));
}

async function loadOrderFromLocal(id: number): Promise<Order | null> {
  // Buscar por id local o por serverId
  const local = await db.orders.get(id)
    ?? await db.orders.where('serverId').equals(id).first();
  if (!local) return null;
  return mapLocalOrder(local);
}

async function mapLocalOrder(o: LocalOrder): Promise<Order> {
  // Cargar cliente desde IndexedDB
  const customer = await db.customers.get(o.customerId)
    ?? await db.customers.where('serverId').equals(o.customerId).first();

  // Cargar usuario desde IndexedDB
  const user = await db.users.get(o.userId)
    ?? await db.users.where('serverId').equals(o.userId).first();

  // Cargar items
  const localItems = await db.orderItems
    .where('orderId').equals(o.id!)
    .filter(i => !i.deletedAt)
    .toArray();

  const items = await Promise.all(localItems.map(async item => {
    const product = await db.products.get(item.productId)
      ?? await db.products.where('serverId').equals(item.productId).first();
    return {
      id: item.id!,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      subtotal: item.totalPrice,
      totalPrice: item.totalPrice,
      product: {
        id: product?.serverId ?? product?.id ?? item.productId,
        name: product?.name ?? `Producto #${item.productId}`,
        code: product?.code ?? '',
      },
    };
  }));

  const isPending = o._syncStatus === SyncStatus.PENDING_CREATE;

  return {
    id: isPending ? o.id! : (o.serverId ?? o.id!),
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    userId: o.userId,
    totalAmount: o.totalAmount,
    status: o.status,
    notes: o.notes,
    customer: {
      id: customer?.serverId ?? customer?.id ?? o.customerId,
      name: customer?.name ?? `Cliente #${o.customerId}`,
      contact: customer?.contact,
      address: customer?.address,
    },
    user: {
      id: user?.serverId ?? user?.id ?? o.userId,
      username: user?.username ?? `Usuario #${o.userId}`,
      role: user?.role ?? 'seller',
    },
    items,
    createdAt: o.createdAt ?? new Date().toISOString(),
    updatedAt: o.updatedAt ?? new Date().toISOString(),
    _isLocal: isPending,
  } as any;
}

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
        const mappedOrders = await loadOrdersFromLocal();
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
      // Fallback a IndexedDB si la API falla
      try {
        const mappedOrders = await loadOrdersFromLocal();
        set({ orders: mappedOrders, loading: false, error: null });
      } catch {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar órdenes';
        set({ error: errorMessage, loading: false });
      }
    }
  },

  getOrderById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const order = await loadOrderFromLocal(id);
        if (order) { set({ currentOrder: order, loading: false }); return; }
        throw new Error('Orden no disponible sin conexión');
      }
      const order = await orderService.getOrderById(id);
      set({ currentOrder: order, loading: false });
    } catch (error: unknown) {
      // Fallback: intentar cargar de IndexedDB (útil para órdenes pendientes de sync)
      try {
        const local = await loadOrderFromLocal(id);
        if (local) { set({ currentOrder: local, loading: false }); return; }
      } catch { /* ignorar */ }
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

    // Sin límite de attempts — reintentar siempre que haya conexión
    const pendingItems = await db.syncQueue
      .where('entityType').equals('order')
      .filter(item => item.operation === 'create')
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
      } catch (err) {
        await db.syncQueue.update(item.id!, {
          attempts: item.attempts + 1,
          lastAttemptAt: Date.now(),
          error: err instanceof Error ? err.message : 'Error desconocido',
        });
        failed++;
      }
    }

    const pendingSync = await db.syncQueue.count();

    // Refrescar la lista de órdenes desde el servidor tras sincronizar
    if (synced > 0) {
      try {
        const response = await orderService.getOrders(1, 50);
        set({
          orders: response.data,
          pendingSync,
          pagination: {
            total: response.pagination?.total || 0,
            page: 1,
            limit: 50,
            totalPages: response.pagination?.totalPages || 0,
          },
        });
      } catch {
        set({ pendingSync });
      }
    } else {
      set({ pendingSync });
    }

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
      // Buscar en IndexedDB (por id local o serverId)
      const localOrder = await db.orders.get(id)
        ?? await db.orders.where('serverId').equals(id).first();

      // Si tiene serverId, eliminar en servidor
      if (localOrder?.serverId || (!localOrder && navigator.onLine)) {
        await orderService.deleteOrder(localOrder?.serverId ?? id);
      }

      // Eliminar de IndexedDB
      if (localOrder?.id) {
        await db.orderItems.where('orderId').equals(localOrder.id).delete();
        // Eliminar de syncQueue si estaba pendiente
        await db.syncQueue.where('entityLocalId').equals(localOrder.id).delete();
        await db.orders.delete(localOrder.id);
      }

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
