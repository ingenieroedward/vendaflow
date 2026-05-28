import { create } from 'zustand';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { orderService } from '../services/orders';
import { PaginationInfo } from '../types';
import { db, SyncStatus, LocalOrder, LocalOrderItem } from '../database/LocalDatabase';
import { orderRepository } from '../repositories/OrderRepository';
import { useUIStore } from './uiStore';

const MAX_SYNC_ATTEMPTS = 5;
let isSyncingOrders = false;
let isSeedingOrders = false;

// ─── Helpers para cargar desde IndexedDB ────────────────────────────────────
//
// Arquitectura offline:
//  - Las órdenes creadas sin conexión se guardan en IndexedDB con _syncStatus = PENDING_CREATE.
//  - Se registra una entrada en db.syncQueue para facilitar el reintento.
//  - Al recuperar conexión, syncPendingOrders() lee directamente por _syncStatus (más robusto
//    que confiar sólo en syncQueue) y envía cada orden al servidor.
//  - Si el servidor acepta la orden, se actualiza el registro local con el serverId y
//    se marca como SYNCED. Si falla, se incrementa attempts en syncQueue para diagnóstico.

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
  // customerId siempre es el ID LOCAL de Dexie (normalizado en seedAllOrders).
  // Para órdenes creadas offline antes de esa normalización, intentamos también por serverId.
  const customer = await db.customers.get(o.customerId)
    ?? await db.customers.where('serverId').equals(o.customerId).first();

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
  retryConflictOrder: (localId: number) => Promise<void>;
  seedAllOrders: () => Promise<void>;
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

        // Transacción atómica: orden + items + syncQueue en una sola operación
        let localId!: number;
        await db.transaction('rw', [db.orders, db.orderItems, db.syncQueue], async () => {
          localId = await db.orders.add(localOrderData as LocalOrder);

          const localItems: Omit<LocalOrderItem, 'id'>[] = data.items.map(item => ({
            orderId: localId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            totalPrice: item.quantity * item.unitPrice, // pre-IVA, igual que el servidor
            _syncStatus: SyncStatus.PENDING_CREATE,
            _version: 1,
            _lastModifiedAt: Date.now(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }));

          await db.orderItems.bulkAdd(localItems as LocalOrderItem[]);

          await db.syncQueue.add({
            entityType: 'order',
            entityLocalId: localId,
            operation: 'create',
            data: { ...data, orderNumber, totalAmount },
            attempts: 0,
            createdAt: Date.now(),
          });
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

  /**
   * Sincroniza todas las órdenes pendientes con el servidor.
   * Itera sobre órdenes con _syncStatus = PENDING_CREATE y las envía una por una.
   * Para construir el payload prioriza los datos de syncQueue; si no están disponibles,
   * reconstruye desde los items guardados en IndexedDB.
   * Al terminar, refresca la lista desde el servidor si hubo al menos una sincronización exitosa.
   * @returns Conteo de órdenes sincronizadas y fallidas.
   */
  syncPendingOrders: async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    if (isSyncingOrders) return { synced: 0, failed: 0 };
    isSyncingOrders = true;
    try {

    // Buscar DIRECTAMENTE órdenes pendientes por _syncStatus (más confiable que syncQueue)
    const pendingOrders = await db.orders
      .where('_syncStatus').equals(SyncStatus.PENDING_CREATE)
      .toArray();

    let synced = 0;
    let failed = 0;

    for (const localOrder of pendingOrders) {
      try {
        // Buscar entrada de syncQueue (puede tener datos completos o vacíos)
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(item => item.entityType === 'order' && item.operation === 'create')
          .first();

        // Obtener items locales del order
        const localItems = await db.orderItems
          .where('orderId').equals(localOrder.id!)
          .filter(i => !i.deletedAt)
          .toArray();

        if (localItems.length === 0) {
          // Orden sin items — no se puede sincronizar
          failed++;
          continue;
        }

        // Saltar si ya superó el límite de reintentos — marcar como CONFLICT y notificar
        if (queueEntry && queueEntry.attempts >= MAX_SYNC_ATTEMPTS) {
          if (localOrder._syncStatus !== SyncStatus.CONFLICT) {
            await db.orders.update(localOrder.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Orden no sincronizada',
              message: `Orden #${localOrder.orderNumber} falló después de ${MAX_SYNC_ATTEMPTS} intentos. Revisa o recrea la orden.`,
              duration: 0, // persistente hasta que el usuario la cierre
            });
          }
          failed++;
          continue;
        }

        // Construir datos del request: usar syncQueue si tiene items, si no reconstruir desde Dexie
        const hasValidQueueData = queueEntry?.data?.items?.length > 0;
        const rawData = hasValidQueueData
          ? queueEntry!.data
          : {
              customerId: localOrder.customerId,
              notes: localOrder.notes,
              items: localItems.map(item => ({
                productId: item.productId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate,
              })),
            };

        // Resolver customerId: puede ser un serverId ya existente o un ID local de cliente offline
        let resolvedCustomerId = rawData.customerId;
        const byServerId = await db.customers.where('serverId').equals(rawData.customerId).first();
        if (!byServerId) {
          const byLocalId = await db.customers.get(rawData.customerId);
          if (byLocalId?.serverId) {
            resolvedCustomerId = byLocalId.serverId;
          } else if (byLocalId && !byLocalId.serverId) {
            // Cliente aún no sincronizado con el servidor — enviar la orden sería peligroso
            if (queueEntry?.id) {
              const nextAttempts = (queueEntry.attempts ?? 0) + 1;
              const errorMsg = `Cliente de la orden aún no está sincronizado. Primero sincroniza clientes y reintenta.`;
              await db.syncQueue.update(queueEntry.id, {
                attempts: nextAttempts,
                lastAttemptAt: Date.now(),
                error: errorMsg,
              });
              if (nextAttempts >= MAX_SYNC_ATTEMPTS) {
                await db.orders.update(localOrder.id!, { _syncStatus: SyncStatus.CONFLICT });
                useUIStore.getState().addNotification({
                  type: 'error',
                  title: 'Orden no sincronizada',
                  message: `Orden #${localOrder.orderNumber}: ${errorMsg}`,
                  duration: 0,
                });
              }
            } else {
              useUIStore.getState().addNotification({
                type: 'warning',
                title: 'Orden en espera',
                message: `Orden #${localOrder.orderNumber}: el cliente aún no está sincronizado.`,
                duration: 8000,
              });
            }
            failed++;
            continue;
          }
        }

        // Resolver productIds: pueden ser IDs locales de productos creados offline
        const resolvedItems = await Promise.all(
          ((rawData.items as any[]) || []).map(async (item: any) => {
            let resolvedProductId = item.productId;
            const prodByServerId = await db.products.where('serverId').equals(item.productId).first();
            if (!prodByServerId) {
              const prodByLocalId = await db.products.get(item.productId);
              if (prodByLocalId?.serverId) resolvedProductId = prodByLocalId.serverId;
            }
            return { ...item, productId: resolvedProductId };
          })
        );

        // Re-validar que siga pendiente (otro sync concurrente pudo haberla enviado ya)
        const fresh = await db.orders.get(localOrder.id!);
        if (!fresh || fresh._syncStatus !== SyncStatus.PENDING_CREATE) {
          synced++;
          continue;
        }

        // Limpiar campos que el servidor genera (orderNumber, totalAmount, status)
        // para evitar conflicto de unique constraint con órdenes soft-deleted
        const { orderNumber: _on, totalAmount: _ta, status: _st, ...cleanData } = rawData as any;

        const order = await orderService.createOrder({ ...cleanData, customerId: resolvedCustomerId, items: resolvedItems });

        // Actualizar orden local con ID del servidor
        await db.orders.update(localOrder.id!, {
          serverId: order.id,
          orderNumber: order.orderNumber,
          _syncStatus: SyncStatus.SYNCED,
          updatedAt: typeof order.updatedAt === 'string'
            ? order.updatedAt
            : new Date(order.updatedAt).toISOString(),
        });

        // Actualizar items locales con serverId del servidor para evitar duplicados en seed
        const serverItems: any[] = (order as any).items ?? [];
        const localOrderItems = await db.orderItems
          .where('orderId').equals(localOrder.id!)
          .filter(i => !i.deletedAt)
          .toArray();
        for (const si of serverItems) {
          const li = localOrderItems.find(l => l.productId === si.productId && !l.serverId);
          if (li?.id) {
            await db.orderItems.update(li.id, { serverId: si.id, _syncStatus: SyncStatus.SYNCED });
          }
        }
        // Marcar cualquier item restante sin serverId también como SYNCED
        await db.orderItems
          .where('orderId').equals(localOrder.id!)
          .filter(i => !i.serverId)
          .modify({ _syncStatus: SyncStatus.SYNCED });

        // Limpiar syncQueue si existía
        if (queueEntry?.id) {
          await db.syncQueue.delete(queueEntry.id);
        }

        synced++;
      } catch (err) {
        // Registrar error en syncQueue
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(item => item.entityType === 'order')
          .first();

        if (queueEntry?.id) {
          const nextAttempts = (queueEntry.attempts ?? 0) + 1;
          await db.syncQueue.update(queueEntry.id, {
            attempts: nextAttempts,
            lastAttemptAt: Date.now(),
            error: err instanceof Error ? err.message : 'Error desconocido',
          });
          if (nextAttempts >= MAX_SYNC_ATTEMPTS) {
            await db.orders.update(localOrder.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Orden no sincronizada',
              message: `Orden #${localOrder.orderNumber}: ${err instanceof Error ? err.message : 'Error desconocido'}`,
              duration: 0,
            });
          }
        } else {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Error de sincronización',
            message: `Orden #${localOrder.orderNumber}: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            duration: 8000,
          });
        }

        failed++;
      }
    }

    // ── PENDING_UPDATE ────────────────────────────────────────────────────────
    const pendingUpdates = await db.orders
      .where('_syncStatus').equals(SyncStatus.PENDING_UPDATE)
      .toArray();

    for (const localOrder of pendingUpdates) {
      try {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(e => e.entityType === 'order' && e.operation === 'update')
          .first();
        if (!queueEntry?.data?.serverId) { failed++; continue; }
        if (queueEntry.attempts >= MAX_SYNC_ATTEMPTS) {
          if (localOrder._syncStatus !== SyncStatus.CONFLICT) {
            await db.orders.update(localOrder.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Edición no sincronizada',
              message: `Cambios en orden #${localOrder.orderNumber} no pudieron guardarse en el servidor.`,
              duration: 0,
            });
          }
          failed++;
          continue;
        }

        const { serverId, ...updateData } = queueEntry.data;
        await orderService.updateOrder(serverId, updateData);
        await db.orders.update(localOrder.id!, { _syncStatus: SyncStatus.SYNCED });
        if (queueEntry.id) await db.syncQueue.delete(queueEntry.id);
        synced++;
      } catch (err) {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(e => e.entityType === 'order' && e.operation === 'update')
          .first();
        if (queueEntry?.id) {
          await db.syncQueue.update(queueEntry.id, {
            attempts: queueEntry.attempts + 1,
            lastAttemptAt: Date.now(),
            error: err instanceof Error ? err.message : 'Error desconocido',
          });
        }
        failed++;
      }
    }

    // ── PENDING_DELETE ────────────────────────────────────────────────────────
    const pendingDeletes = await db.orders
      .where('_syncStatus').equals(SyncStatus.PENDING_DELETE)
      .toArray();

    for (const localOrder of pendingDeletes) {
      try {
        if (!localOrder.serverId) { failed++; continue; }
        const deleteEntry = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(e => e.entityType === 'order' && e.operation === 'delete')
          .first();
        if (deleteEntry && deleteEntry.attempts >= MAX_SYNC_ATTEMPTS) { failed++; continue; }
        await orderService.deleteOrder(localOrder.serverId);
        await db.orderItems.where('orderId').equals(localOrder.id!).delete();
        await db.syncQueue.where('entityLocalId').equals(localOrder.id!).delete();
        await db.orders.delete(localOrder.id!);
        synced++;
      } catch (err) {
        const q = await db.syncQueue
          .where('entityLocalId').equals(localOrder.id!)
          .filter(e => e.entityType === 'order' && e.operation === 'delete')
          .first();
        if (q?.id) {
          await db.syncQueue.update(q.id, { attempts: q.attempts + 1, lastAttemptAt: Date.now(), error: err instanceof Error ? err.message : 'Error' });
        }
        failed++;
      }
    }

    const pendingSync = await db.syncQueue.count();

    // Refrescar lista desde el servidor si se sincronizó algo
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
    } finally {
      isSyncingOrders = false;
    }
  },

  updateOrder: async (id, data) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.orders.where('serverId').equals(id).first()
          ?? await db.orders.get(id);
        if (!local?.id) throw new Error('Orden no disponible sin conexión');

        await db.orders.update(local.id, {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.customerId !== undefined && { customerId: data.customerId }),
          _syncStatus: SyncStatus.PENDING_UPDATE,
          _lastModifiedAt: Date.now(),
          updatedAt: new Date().toISOString(),
        });

        const existing = await db.syncQueue
          .where('entityLocalId').equals(local.id)
          .filter(e => e.entityType === 'order' && e.operation === 'update')
          .first();
        if (existing?.id) {
          await db.syncQueue.update(existing.id, { data: { ...data, serverId: id } });
        } else {
          await db.syncQueue.add({
            entityType: 'order', entityLocalId: local.id,
            operation: 'update', data: { ...data, serverId: id },
            attempts: 0, createdAt: Date.now(),
          });
        }

        const pendingSync = await db.syncQueue.count();
        let mergedOrder: Order | null = null;
        set(state => {
          const cur = state.orders.find(o => o.id === id) ?? state.currentOrder;
          mergedOrder = cur ? { ...cur, ...data } as Order : null;
          return {
            orders: state.orders.map(o => o.id === id ? (mergedOrder ?? o) : o),
            currentOrder: state.currentOrder?.id === id ? (mergedOrder ?? state.currentOrder) : state.currentOrder,
            loading: false, pendingSync,
          };
        });
        if (!mergedOrder) throw new Error('Orden no encontrada en caché');
        return mergedOrder;
      }

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
      const localOrder = await db.orders.get(id)
        ?? await db.orders.where('serverId').equals(id).first();

      if (!navigator.onLine) {
        if (localOrder?.id) {
          if (localOrder.serverId) {
            // Has a server copy — queue deletion for when back online
            await db.orders.update(localOrder.id, {
              _syncStatus: SyncStatus.PENDING_DELETE,
              _lastModifiedAt: Date.now(),
              deletedAt: new Date().toISOString(),
            });
            const existing = await db.syncQueue
              .where('entityLocalId').equals(localOrder.id)
              .filter(e => e.entityType === 'order' && e.operation === 'delete')
              .first();
            if (!existing) {
              await db.syncQueue.add({
                entityType: 'order', entityLocalId: localOrder.id,
                operation: 'delete', data: { serverId: localOrder.serverId },
                attempts: 0, createdAt: Date.now(),
              });
            }
          } else {
            // Only local (never synced) — delete directly
            await db.orderItems.where('orderId').equals(localOrder.id).delete();
            await db.syncQueue.where('entityLocalId').equals(localOrder.id).delete();
            await db.orders.delete(localOrder.id);
          }
        }
        const pendingSync = await db.syncQueue.count();
        set(state => ({
          orders: state.orders.filter(o => o.id !== id),
          currentOrder: state.currentOrder?.id === id ? null : state.currentOrder,
          loading: false, pendingSync,
        }));
        return;
      }

      // Online: delete on server first, then locally
      if (localOrder?.serverId || (!localOrder && navigator.onLine)) {
        await orderService.deleteOrder(localOrder?.serverId ?? id);
      }
      if (localOrder?.id) {
        await db.orderItems.where('orderId').equals(localOrder.id).delete();
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

  seedAllOrders: async () => {
    if (!navigator.onLine || isSeedingOrders) return;
    isSeedingOrders = true;
    useUIStore.getState().startSeedingStep('órdenes');
    try {
      const response = await orderService.getOrders(1, 200);
      if (!response.data?.length) return;

      // Guardar el número máximo del servidor para que getNextOrderNumber()
      // no reinicie a ORD-001 si el usuario borra los datos locales
      const serverMax = response.data.reduce((max, o) => {
        const match = o.orderNumber?.match(/ORD-(\d+)/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(max, n);
      }, 0);
      if (serverMax > 0) localStorage.setItem('serverMaxOrderNumber', String(serverMax));

      for (const order of response.data) {
        // Resolver customerId del servidor al ID LOCAL de Dexie para que mapLocalOrder
        // siempre encuentre el cliente correcto con db.customers.get(customerId)
        const serverCustomerId = (order.customer as any)?.id ?? order.customerId;
        const localCustomer = await db.customers.where('serverId').equals(serverCustomerId).first();
        const resolvedCustomerId = localCustomer?.id ?? serverCustomerId;

        const serverUserId = (order.user as any)?.id ?? order.userId;
        const localUser = await db.users.where('serverId').equals(serverUserId).first();
        const resolvedUserId = localUser?.id ?? serverUserId;

        // Upsert order — deduplicar si hay múltiples registros locales con el mismo serverId
        // (puede ocurrir si seed y sync corrieron concurrentemente en sesiones previas)
        const existingAll = await db.orders.where('serverId').equals(order.id).toArray();
        // Eliminar duplicados: conservar el primero (o el SYNCED), borrar el resto
        if (existingAll.length > 1) {
          const toKeep = existingAll.find(o => o._syncStatus === SyncStatus.SYNCED) ?? existingAll[0];
          for (const dup of existingAll) {
            if (dup.id !== toKeep.id) {
              await db.orderItems.where('orderId').equals(dup.id!).delete();
              await db.orders.delete(dup.id!);
            }
          }
        }

        const existing = existingAll.find(o => o._syncStatus === SyncStatus.SYNCED) ?? existingAll[0];
        const orderData = {
          serverId: order.id,
          orderNumber: order.orderNumber,
          customerId: resolvedCustomerId,
          userId: resolvedUserId,
          totalAmount: order.totalAmount,
          status: order.status,
          notes: order.notes ?? null,
          _syncStatus: SyncStatus.SYNCED as const,
          _version: 1,
          _lastModifiedAt: Date.now(),
          createdAt: typeof order.createdAt === 'string' ? order.createdAt : new Date(order.createdAt).toISOString(),
          updatedAt: typeof order.updatedAt === 'string' ? order.updatedAt : new Date(order.updatedAt).toISOString(),
        };

        let localId: number;
        if (existing?.id) {
          // Nunca sobreescribir cambios pendientes del usuario con datos del servidor
          if (existing._syncStatus !== SyncStatus.SYNCED) {
            localId = existing.id;
          } else {
            await db.orders.update(existing.id, orderData);
            localId = existing.id;
          }
        } else {
          localId = await db.orders.add(orderData as LocalOrder);
        }

        // Upsert items (solo para ordenes que no tienen cambios pendientes)
        const existingOrder = await db.orders.get(localId);
        if (existingOrder?._syncStatus !== SyncStatus.SYNCED) continue;

        const items: any[] = (order as any).items ?? [];
        for (const item of items) {
          const itemData = {
            serverId: item.id,
            orderId: localId,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            taxRate: item.taxRate,
            totalPrice: item.subtotal ?? item.totalPrice ?? item.quantity * item.unitPrice,
            _syncStatus: SyncStatus.SYNCED,
            _version: 1,
            _lastModifiedAt: Date.now(),
            createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
            updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
          };
          // Buscar primero por serverId; si no existe, buscar por orderId+productId
          // para actualizar items offline que aún no tienen serverId (evita duplicados)
          const existingItem = item.id
            ? (await db.orderItems.where('serverId').equals(item.id).first()
               ?? await db.orderItems
                    .where('orderId').equals(localId)
                    .filter(i => i.productId === item.productId && !i.serverId)
                    .first())
            : null;
          if (existingItem?.id) {
            if (existingItem._syncStatus === SyncStatus.SYNCED) {
              await db.orderItems.update(existingItem.id, itemData);
            }
          } else {
            // Solo agregar si no existe ya un item con el mismo serverId
            const dupCheck = item.id
              ? await db.orderItems.where('serverId').equals(item.id).count()
              : 0;
            if (dupCheck === 0) await db.orderItems.add(itemData as LocalOrderItem);
          }
        }

        // Eliminar items huérfanos sin serverId — copias offline reemplazadas por los del servidor
        await db.orderItems
          .where('orderId').equals(localId)
          .filter(i => !i.serverId)
          .delete();
      }
    } catch { /* silent */ }
    finally {
      isSeedingOrders = false;
      useUIStore.getState().finishSeedingStep('órdenes');
    }
  },

  retryConflictOrder: async (localId: number) => {
    // Resetear estado CONFLICT → PENDING_CREATE y limpiar intentos fallidos
    await db.orders.update(localId, {
      _syncStatus: SyncStatus.PENDING_CREATE,
      _lastModifiedAt: Date.now(),
    });
    const queueEntry = await db.syncQueue
      .where('entityLocalId').equals(localId)
      .filter(e => e.entityType === 'order')
      .first();
    if (queueEntry?.id) {
      await db.syncQueue.update(queueEntry.id, { attempts: 0, error: undefined, lastAttemptAt: undefined });
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentOrder: () => set({ currentOrder: null }),
}));

