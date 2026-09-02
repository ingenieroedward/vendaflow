import { create } from 'zustand';
import { Quote, CreateQuoteRequest, UpdateQuoteRequest, QuoteFilters } from '../types/quote';
import { Order } from '../types/order';
import { quoteService } from '../services/quotes';
import { PaginationInfo } from '../types';
import { db, SyncStatus, LocalQuote, LocalQuoteItem } from '../database/LocalDatabase';
import { quoteRepository } from '../repositories/QuoteRepository';
import { useUIStore } from './uiStore';
import { useAuthStore } from './authStore';

// Mirror de orderStore.ts, adaptado para cotizaciones: no descuentan stock (no
// hay maquinaria de reconciliación de inventario acá) y no llevan pago a plazo.

const MAX_SYNC_ATTEMPTS = 5;
let isSyncingQuotes = false;
let isSeedingQuotes = false;

// Detecta error de red (sin respuesta del servidor) vs error de validación (400/422/etc.)
function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as any;
  if (e.isNetworkError === true) return true;      // ApiRequestError del interceptor
  if (e.isAxiosError && !e.response) return true; // Axios sin respuesta = red caída
  if (err instanceof TypeError) return true;       // Fetch: network failure
  return false;
}

const newClientRef = () =>
  (crypto as any).randomUUID?.() ?? `ref-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// Guarda una cotización localmente con PENDING_CREATE (offline o fallback de red)
async function saveQuoteLocal(data: CreateQuoteRequest): Promise<Quote> {
  const quoteNumber = await quoteRepository.getNextQuoteNumber();
  const totalAmount = data.items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * (1 + item.taxRate / 100), 0
  );

  const localQuoteData: Omit<LocalQuote, 'id'> = {
    quoteNumber,
    customerId: data.customerId,
    userId: data.userId ?? 0,
    totalAmount,
    status: data.status ?? 'draft',
    notes: data.notes,
    validUntil: data.validUntil,
    _syncStatus: SyncStatus.PENDING_CREATE,
    _version: 1,
    _lastModifiedAt: Date.now(),
    _clientRef: data.clientRef ?? newClientRef(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  let localId!: number;
  await db.transaction('rw', [db.quotes, db.quoteItems, db.syncQueue], async () => {
    localId = await db.quotes.add(localQuoteData as LocalQuote);

    const localItems: Omit<LocalQuoteItem, 'id'>[] = data.items.map(item => ({
      quoteId: localId,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate,
      totalPrice: item.quantity * item.unitPrice,
      _syncStatus: SyncStatus.PENDING_CREATE,
      _version: 1,
      _lastModifiedAt: Date.now(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    await db.quoteItems.bulkAdd(localItems as LocalQuoteItem[]);

    await db.syncQueue.add({
      entityType: 'quote',
      entityLocalId: localId,
      operation: 'create',
      data: { ...data, quoteNumber, totalAmount },
      attempts: 0,
      createdAt: Date.now(),
    });
  });

  return {
    id: localId,
    quoteNumber,
    customerId: data.customerId,
    userId: data.userId ?? 0,
    totalAmount,
    status: data.status ?? 'draft',
    notes: data.notes,
    validUntil: data.validUntil,
    convertedOrderId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _isLocal: true,
  } as unknown as Quote;
}

// ─── Helpers para cargar desde IndexedDB ────────────────────────────────────
// Misma arquitectura offline que orderStore.ts — ver comentario ahí.

async function loadQuotesFromLocal(): Promise<Quote[]> {
  const localQuotes = await db.quotes.filter(q => !q.deletedAt).reverse().toArray();
  return Promise.all(localQuotes.map(q => mapLocalQuote(q)));
}

async function loadQuoteFromLocal(id: number): Promise<Quote | null> {
  // Buscar por id local o por serverId
  const local = await db.quotes.get(id)
    ?? await db.quotes.where('serverId').equals(id).first();
  if (!local) return null;
  return mapLocalQuote(local);
}

async function mapLocalQuote(q: LocalQuote): Promise<Quote> {
  // customerId siempre es el ID LOCAL de Dexie (normalizado en seedAllQuotes).
  const customer = await db.customers.get(q.customerId)
    ?? await db.customers.where('serverId').equals(q.customerId).first();

  let user = await db.users.get(q.userId)
    ?? await db.users.where('serverId').equals(q.userId).first();

  // Fallback: if user not in IndexedDB, use the currently authenticated user
  if (!user) {
    const authUser = useAuthStore.getState().user;
    if (authUser && authUser.id === q.userId) {
      user = { username: authUser.username, role: authUser.role } as any;
    }
  }

  // Cargar items
  const localItems = await db.quoteItems
    .where('quoteId').equals(q.id!)
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

  const isPending = q._syncStatus === SyncStatus.PENDING_CREATE;

  return {
    id: isPending ? q.id! : (q.serverId ?? q.id!),
    quoteNumber: q.quoteNumber,
    customerId: q.customerId,
    userId: q.userId,
    totalAmount: q.totalAmount,
    status: q.status,
    notes: q.notes,
    validUntil: q.validUntil,
    convertedOrderId: q.convertedOrderId,
    customer: {
      id: customer?.serverId ?? customer?.id ?? q.customerId,
      name: customer?.name ?? `Cliente #${q.customerId}`,
      code: customer?.code,
      nit: customer?.nit,
      contact: customer?.contact,
      address: customer?.address,
    },
    user: {
      id: user?.serverId ?? user?.id ?? q.userId,
      username: user?.username ?? `Usuario #${q.userId}`,
      role: user?.role ?? 'seller',
    },
    items,
    createdAt: q.createdAt ?? new Date().toISOString(),
    updatedAt: q.updatedAt ?? new Date().toISOString(),
    _isLocal: isPending,
  } as any;
}

interface QuoteState {
  quotes: Quote[];
  currentQuote: Quote | null;
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  pendingSync: number; // cotizaciones pendientes de sincronizar

  // Actions
  getQuotes: (page?: number, limit?: number, filters?: QuoteFilters) => Promise<void>;
  loadMoreQuotes: () => Promise<void>;
  getQuoteById: (id: number) => Promise<void>;
  createQuote: (data: CreateQuoteRequest) => Promise<Quote>;
  updateQuote: (id: number, data: UpdateQuoteRequest) => Promise<Quote>;
  deleteQuote: (id: number) => Promise<void>;
  convertToOrder: (id: number) => Promise<Order>;
  syncPendingQuotes: () => Promise<{ synced: number; failed: number }>;
  retryConflictQuote: (localId: number) => Promise<void>;
  seedAllQuotes: () => Promise<void>;
  clearError: () => void;
  clearCurrentQuote: () => void;
}

export const useQuoteStore = create<QuoteState>((set, get) => ({
  quotes: [],
  currentQuote: null,
  loading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
  pendingSync: 0,

  // Trae la siguiente página y la agrega a las ya cargadas (sin duplicar)
  loadMoreQuotes: async () => {
    const { pagination, quotes, loading } = get();
    if (loading || !navigator.onLine || quotes.length >= pagination.total) return;
    set({ loading: true });
    try {
      const nextPage = pagination.page + 1;
      const response = await quoteService.getQuotes(nextPage, pagination.limit);
      const seen = new Set(quotes.map(q => q.id));
      set({
        quotes: [...quotes, ...response.data.filter(q => !seen.has(q.id))],
        pagination: {
          total: response.pagination?.total ?? pagination.total,
          page: nextPage,
          limit: pagination.limit,
          totalPages: response.pagination?.totalPages ?? pagination.totalPages,
        },
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  getQuotes: async (page = 1, limit = 10, filters) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const mappedQuotes = await loadQuotesFromLocal();
        set({
          quotes: mappedQuotes,
          pagination: { total: mappedQuotes.length, page: 1, limit: mappedQuotes.length, totalPages: 1 },
          loading: false,
          error: null,
        });
        return;
      }

      const response = await quoteService.getQuotes(page, limit, filters);
      set({
        quotes: response.data,
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
        const mappedQuotes = await loadQuotesFromLocal();
        set({ quotes: mappedQuotes, loading: false, error: null });
      } catch {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar cotizaciones';
        set({ error: errorMessage, loading: false });
      }
    }
  },

  getQuoteById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const quote = await loadQuoteFromLocal(id);
        if (quote) { set({ currentQuote: quote, loading: false }); return; }
        throw new Error('Cotización no disponible sin conexión');
      }
      const quote = await quoteService.getQuoteById(id);
      set({ currentQuote: quote, loading: false });
    } catch (error: unknown) {
      // Fallback: intentar cargar de IndexedDB (útil para cotizaciones pendientes de sync)
      try {
        const local = await loadQuoteFromLocal(id);
        if (local) { set({ currentQuote: local, loading: false }); return; }
      } catch { /* ignorar */ }
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar cotización';
      set({ error: errorMessage, loading: false });
    }
  },

  createQuote: async (data) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        // === OFFLINE CONFIRMADO: guardar en IndexedDB ===
        const quote = await saveQuoteLocal(data);
        const pendingSync = await db.syncQueue.filter(e => e.entityType === 'quote').count();
        set({ loading: false, pendingSync });
        return quote;
      }

      // === ONLINE: intentar servidor, fallback a local si falla la red ===
      // El mismo clientRef viaja en el intento directo y en el fallback local:
      // si el POST llegó pero la respuesta se perdió, el sync no duplica
      if (!data.clientRef) data = { ...data, clientRef: newClientRef() };
      try {
        const quote = await quoteService.createQuote(data);
        set({ loading: false });
        return quote;
      } catch (apiError: unknown) {
        if (!isNetworkError(apiError)) throw apiError; // 400/422/etc → propagar al usuario
        // Sin respuesta del servidor (señal débil, servidor caído) → guardar localmente
        const quote = await saveQuoteLocal(data);
        const pendingSync = await db.syncQueue.filter(e => e.entityType === 'quote').count();
        set({ loading: false, pendingSync });
        return quote;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear cotización';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  // Convertir a orden requiere conexión — descontar stock real no puede
  // resolverse offline (mismo alcance deliberado que POS: se deja fuera del
  // refuerzo offline, ver nota en Pos.tsx).
  convertToOrder: async (id: number) => {
    if (!navigator.onLine) throw new Error('Convertir a orden requiere conexión a internet');
    set({ loading: true, error: null });
    try {
      const order = await quoteService.convertToOrder(id);
      // Refrescar la cotización actual si es la que se convirtió
      set(state => {
        if (state.currentQuote?.id !== id) return { loading: false };
        return {
          loading: false,
          currentQuote: { ...state.currentQuote, status: 'converted', convertedOrderId: order.id },
        };
      });
      return order;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al convertir a orden';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  /**
   * Sincroniza todas las cotizaciones pendientes con el servidor.
   * Mismo algoritmo que orderStore.ts::syncPendingOrders — ver ahí los comentarios
   * detallados de cada paso.
   */
  syncPendingQuotes: async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    // Lock entre pestañas: dos tabs comparten IndexedDB pero no las variables
    // de módulo — sin esto pueden enviar la misma cotización en paralelo
    const locks = (navigator as any).locks;
    if (locks?.request && !(useQuoteStore as any).__inLock) {
      return locks.request('merco-sync-quotes', { ifAvailable: true }, async (lock: unknown) => {
        if (!lock) return { synced: 0, failed: 0 }; // otra pestaña está sincronizando
        (useQuoteStore as any).__inLock = true;
        try { return await useQuoteStore.getState().syncPendingQuotes(); }
        finally { (useQuoteStore as any).__inLock = false; }
      });
    }
    if (isSyncingQuotes) return { synced: 0, failed: 0 };
    isSyncingQuotes = true;
    try {

    // Buscar DIRECTAMENTE cotizaciones pendientes por _syncStatus (más confiable que syncQueue)
    const pendingQuotes = await db.quotes
      .where('_syncStatus').equals(SyncStatus.PENDING_CREATE)
      .toArray();

    let synced = 0;
    let failed = 0;

    for (const localQuote of pendingQuotes) {
      try {
        // Buscar entrada de syncQueue (puede tener datos completos o vacíos)
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localQuote.id!)
          .filter(item => item.entityType === 'quote' && item.operation === 'create')
          .first();

        // Obtener items locales de la cotización
        const localItems = await db.quoteItems
          .where('quoteId').equals(localQuote.id!)
          .filter(i => !i.deletedAt)
          .toArray();

        if (localItems.length === 0) {
          // Cotización sin items — no se puede sincronizar
          failed++;
          continue;
        }

        // Saltar si ya superó el límite de reintentos — marcar como CONFLICT y notificar
        if (queueEntry && queueEntry.attempts >= MAX_SYNC_ATTEMPTS) {
          if (localQuote._syncStatus !== SyncStatus.CONFLICT) {
            await db.quotes.update(localQuote.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Cotización no sincronizada',
              message: `Cotización #${localQuote.quoteNumber} falló después de ${MAX_SYNC_ATTEMPTS} intentos. Revisa o recréala.`,
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
              customerId: localQuote.customerId,
              notes: localQuote.notes,
              validUntil: localQuote.validUntil,
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
            // Cliente aún no sincronizado con el servidor — enviar la cotización sería peligroso
            if (queueEntry?.id) {
              const nextAttempts = (queueEntry.attempts ?? 0) + 1;
              const errorMsg = `Cliente de la cotización aún no está sincronizado. Primero sincroniza clientes y reintenta.`;
              await db.syncQueue.update(queueEntry.id, {
                attempts: nextAttempts,
                lastAttemptAt: Date.now(),
                error: errorMsg,
              });
              if (nextAttempts >= MAX_SYNC_ATTEMPTS) {
                await db.quotes.update(localQuote.id!, { _syncStatus: SyncStatus.CONFLICT });
                useUIStore.getState().addNotification({
                  type: 'error',
                  title: 'Cotización no sincronizada',
                  message: `Cotización #${localQuote.quoteNumber}: ${errorMsg}`,
                  duration: 0,
                });
              }
            } else {
              useUIStore.getState().addNotification({
                type: 'warning',
                title: 'Cotización en espera',
                message: `Cotización #${localQuote.quoteNumber}: el cliente aún no está sincronizado.`,
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
        const fresh = await db.quotes.get(localQuote.id!);
        if (!fresh || fresh._syncStatus !== SyncStatus.PENDING_CREATE) {
          synced++;
          continue;
        }

        // Limpiar campos que el servidor genera (quoteNumber, totalAmount, status)
        // para evitar conflicto de unique constraint con cotizaciones soft-deleted
        const { quoteNumber: _qn, totalAmount: _ta, status: _st, ...cleanData } = rawData as any;

        // Clave de idempotencia persistida: si este POST se reintenta (timeout,
        // doble pestaña), el server devuelve la cotización existente en vez de duplicar
        let clientRef = fresh._clientRef;
        if (!clientRef) {
          clientRef = newClientRef();
          await db.quotes.update(localQuote.id!, { _clientRef: clientRef });
        }

        const quote = await quoteService.createQuote({ ...cleanData, clientRef, customerId: resolvedCustomerId, items: resolvedItems });

        // Actualizar cotización local con ID del servidor
        await db.quotes.update(localQuote.id!, {
          serverId: quote.id,
          quoteNumber: quote.quoteNumber,
          _syncStatus: SyncStatus.SYNCED,
          updatedAt: typeof quote.updatedAt === 'string'
            ? quote.updatedAt
            : new Date(quote.updatedAt).toISOString(),
        });

        // Actualizar items locales con serverId del servidor para evitar duplicados en seed
        const serverItems: any[] = (quote as any).items ?? [];
        const localQuoteItems = await db.quoteItems
          .where('quoteId').equals(localQuote.id!)
          .filter(i => !i.deletedAt)
          .toArray();
        for (const si of serverItems) {
          const li = localQuoteItems.find(l => l.productId === si.productId && !l.serverId);
          if (li?.id) {
            await db.quoteItems.update(li.id, { serverId: si.id, _syncStatus: SyncStatus.SYNCED });
          }
        }
        // Marcar cualquier item restante sin serverId también como SYNCED
        await db.quoteItems
          .where('quoteId').equals(localQuote.id!)
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
          .where('entityLocalId').equals(localQuote.id!)
          .filter(item => item.entityType === 'quote')
          .first();

        if (queueEntry?.id) {
          const nextAttempts = (queueEntry.attempts ?? 0) + 1;
          await db.syncQueue.update(queueEntry.id, {
            attempts: nextAttempts,
            lastAttemptAt: Date.now(),
            error: err instanceof Error ? err.message : 'Error desconocido',
          });
          if (nextAttempts >= MAX_SYNC_ATTEMPTS) {
            await db.quotes.update(localQuote.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Cotización no sincronizada',
              message: `Cotización #${localQuote.quoteNumber}: ${err instanceof Error ? err.message : 'Error desconocido'}`,
              duration: 0,
            });
          }
        } else {
          useUIStore.getState().addNotification({
            type: 'error',
            title: 'Error de sincronización',
            message: `Cotización #${localQuote.quoteNumber}: ${err instanceof Error ? err.message : 'Error desconocido'}`,
            duration: 8000,
          });
        }

        failed++;
      }
    }

    // ── PENDING_UPDATE ────────────────────────────────────────────────────────
    const pendingUpdates = await db.quotes
      .where('_syncStatus').equals(SyncStatus.PENDING_UPDATE)
      .toArray();

    for (const localQuote of pendingUpdates) {
      try {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localQuote.id!)
          .filter(e => e.entityType === 'quote' && e.operation === 'update')
          .first();
        if (!queueEntry?.data?.serverId) { failed++; continue; }
        if (queueEntry.attempts >= MAX_SYNC_ATTEMPTS) {
          if (localQuote._syncStatus !== SyncStatus.CONFLICT) {
            await db.quotes.update(localQuote.id!, { _syncStatus: SyncStatus.CONFLICT });
            useUIStore.getState().addNotification({
              type: 'error',
              title: 'Edición no sincronizada',
              message: `Cambios en cotización #${localQuote.quoteNumber} no pudieron guardarse en el servidor.`,
              duration: 0,
            });
          }
          failed++;
          continue;
        }

        const { serverId, ...updateData } = queueEntry.data;
        await quoteService.updateQuote(serverId, updateData);
        await db.quotes.update(localQuote.id!, { _syncStatus: SyncStatus.SYNCED });
        if (queueEntry.id) await db.syncQueue.delete(queueEntry.id);
        synced++;
      } catch (err) {
        const queueEntry = await db.syncQueue
          .where('entityLocalId').equals(localQuote.id!)
          .filter(e => e.entityType === 'quote' && e.operation === 'update')
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
    const pendingDeletes = await db.quotes
      .where('_syncStatus').equals(SyncStatus.PENDING_DELETE)
      .toArray();

    for (const localQuote of pendingDeletes) {
      try {
        if (!localQuote.serverId) { failed++; continue; }
        const deleteEntry = await db.syncQueue
          .where('entityLocalId').equals(localQuote.id!)
          .filter(e => e.entityType === 'quote' && e.operation === 'delete')
          .first();
        if (deleteEntry && deleteEntry.attempts >= MAX_SYNC_ATTEMPTS) { failed++; continue; }
        await quoteService.deleteQuote(localQuote.serverId);
        await db.quoteItems.where('quoteId').equals(localQuote.id!).delete();
        await db.syncQueue.where('entityLocalId').equals(localQuote.id!).filter(e => e.entityType === 'quote').delete();
        await db.quotes.delete(localQuote.id!);
        synced++;
      } catch (err) {
        const q = await db.syncQueue
          .where('entityLocalId').equals(localQuote.id!)
          .filter(e => e.entityType === 'quote' && e.operation === 'delete')
          .first();
        if (q?.id) {
          await db.syncQueue.update(q.id, { attempts: q.attempts + 1, lastAttemptAt: Date.now(), error: err instanceof Error ? err.message : 'Error' });
        }
        failed++;
      }
    }

    const pendingSync = await db.syncQueue.filter(e => e.entityType === 'quote').count();

    // Refrescar lista desde el servidor si se sincronizó algo
    if (synced > 0) {
      try {
        const response = await quoteService.getQuotes(1, 50);
        set({
          quotes: response.data,
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
      isSyncingQuotes = false;
    }
  },

  updateQuote: async (id, data) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.quotes.where('serverId').equals(id).first()
          ?? await db.quotes.get(id);
        if (!local?.id) throw new Error('Cotización no disponible sin conexión');

        await db.quotes.update(local.id, {
          ...(data.status !== undefined && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.customerId !== undefined && { customerId: data.customerId }),
          ...(data.validUntil !== undefined && { validUntil: data.validUntil }),
          _syncStatus: SyncStatus.PENDING_UPDATE,
          _lastModifiedAt: Date.now(),
          updatedAt: new Date().toISOString(),
        });

        const existing = await db.syncQueue
          .where('entityLocalId').equals(local.id)
          .filter(e => e.entityType === 'quote' && e.operation === 'update')
          .first();
        if (existing?.id) {
          await db.syncQueue.update(existing.id, { data: { ...data, serverId: id } });
        } else {
          await db.syncQueue.add({
            entityType: 'quote', entityLocalId: local.id,
            operation: 'update', data: { ...data, serverId: id },
            attempts: 0, createdAt: Date.now(),
          });
        }

        const pendingSync = await db.syncQueue.filter(e => e.entityType === 'quote').count();
        let mergedQuote: Quote | null = null;
        set(state => {
          const cur = state.quotes.find(q => q.id === id) ?? state.currentQuote;
          mergedQuote = cur ? { ...cur, ...data } as Quote : null;
          return {
            quotes: state.quotes.map(q => q.id === id ? (mergedQuote ?? q) : q),
            currentQuote: state.currentQuote?.id === id ? (mergedQuote ?? state.currentQuote) : state.currentQuote,
            loading: false, pendingSync,
          };
        });
        if (!mergedQuote) throw new Error('Cotización no encontrada en caché');
        return mergedQuote;
      }

      const quote = await quoteService.updateQuote(id, data);
      set(state => ({
        quotes: state.quotes.map(q => q.id === id ? quote : q),
        currentQuote: state.currentQuote?.id === id ? quote : state.currentQuote,
        loading: false,
      }));
      return quote;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar cotización';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteQuote: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const localQuote = await db.quotes.get(id)
        ?? await db.quotes.where('serverId').equals(id).first();

      if (!navigator.onLine) {
        if (localQuote?.id) {
          if (localQuote.serverId) {
            // Has a server copy — queue deletion for when back online
            await db.quotes.update(localQuote.id, {
              _syncStatus: SyncStatus.PENDING_DELETE,
              _lastModifiedAt: Date.now(),
              deletedAt: new Date().toISOString(),
            });
            const existing = await db.syncQueue
              .where('entityLocalId').equals(localQuote.id)
              .filter(e => e.entityType === 'quote' && e.operation === 'delete')
              .first();
            if (!existing) {
              await db.syncQueue.add({
                entityType: 'quote', entityLocalId: localQuote.id,
                operation: 'delete', data: { serverId: localQuote.serverId },
                attempts: 0, createdAt: Date.now(),
              });
            }
          } else {
            // Only local (never synced) — delete directly
            await db.quoteItems.where('quoteId').equals(localQuote.id).delete();
            await db.syncQueue.where('entityLocalId').equals(localQuote.id).filter(e => e.entityType === 'quote').delete();
            await db.quotes.delete(localQuote.id);
          }
        }
        const pendingSync = await db.syncQueue.filter(e => e.entityType === 'quote').count();
        set(state => ({
          quotes: state.quotes.filter(q => q.id !== id),
          currentQuote: state.currentQuote?.id === id ? null : state.currentQuote,
          loading: false, pendingSync,
        }));
        return;
      }

      // Online: delete on server first, then locally
      if (localQuote?.serverId || (!localQuote && navigator.onLine)) {
        await quoteService.deleteQuote(localQuote?.serverId ?? id);
      }
      if (localQuote?.id) {
        await db.quoteItems.where('quoteId').equals(localQuote.id).delete();
        await db.syncQueue.where('entityLocalId').equals(localQuote.id).filter(e => e.entityType === 'quote').delete();
        await db.quotes.delete(localQuote.id);
      }
      set(state => ({
        quotes: state.quotes.filter(q => q.id !== id),
        currentQuote: state.currentQuote?.id === id ? null : state.currentQuote,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar cotización';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  seedAllQuotes: async () => {
    if (!navigator.onLine || isSeedingQuotes) return;
    isSeedingQuotes = true;
    useUIStore.getState().startSeedingStep('cotizaciones');
    try {
      const response = await quoteService.getQuotes(1, 200);
      if (!response.data?.length) return;

      // Guardar el número máximo del servidor para que getNextQuoteNumber()
      // no reinicie a COT-001 si el usuario borra los datos locales
      const serverMax = response.data.reduce((max, q) => {
        const match = q.quoteNumber?.match(/COT-(\d+)/);
        const n = match ? parseInt(match[1], 10) : 0;
        return Math.max(max, n);
      }, 0);
      if (serverMax > 0) localStorage.setItem('serverMaxQuoteNumber', String(serverMax));

      for (const quote of response.data) {
        // Resolver customerId del servidor al ID LOCAL de Dexie para que mapLocalQuote
        // siempre encuentre el cliente correcto con db.customers.get(customerId)
        const serverCustomerId = (quote.customer as any)?.id ?? quote.customerId;
        const localCustomer = await db.customers.where('serverId').equals(serverCustomerId).first();
        const resolvedCustomerId = localCustomer?.id ?? serverCustomerId;

        const serverUserId = (quote.user as any)?.id ?? quote.userId;
        const localUser = await db.users.where('serverId').equals(serverUserId).first();
        const resolvedUserId = localUser?.id ?? serverUserId;

        // Upsert quote — deduplicar si hay múltiples registros locales con el mismo serverId
        const existingAll = await db.quotes.where('serverId').equals(quote.id).toArray();
        if (existingAll.length > 1) {
          const toKeep = existingAll.find(q => q._syncStatus === SyncStatus.SYNCED) ?? existingAll[0];
          for (const dup of existingAll) {
            if (dup.id !== toKeep.id) {
              await db.quoteItems.where('quoteId').equals(dup.id!).delete();
              await db.quotes.delete(dup.id!);
            }
          }
        }

        const existing = existingAll.find(q => q._syncStatus === SyncStatus.SYNCED) ?? existingAll[0];
        const quoteData = {
          serverId: quote.id,
          quoteNumber: quote.quoteNumber,
          customerId: resolvedCustomerId,
          userId: resolvedUserId,
          totalAmount: quote.totalAmount,
          status: quote.status,
          notes: quote.notes ?? null,
          validUntil: quote.validUntil ?? null,
          convertedOrderId: quote.convertedOrderId ?? null,
          _syncStatus: SyncStatus.SYNCED as const,
          _version: 1,
          _lastModifiedAt: Date.now(),
          createdAt: typeof quote.createdAt === 'string' ? quote.createdAt : new Date(quote.createdAt).toISOString(),
          updatedAt: typeof quote.updatedAt === 'string' ? quote.updatedAt : new Date(quote.updatedAt).toISOString(),
        };

        let localId: number;
        if (existing?.id) {
          // Nunca sobreescribir cambios pendientes del usuario con datos del servidor
          if (existing._syncStatus !== SyncStatus.SYNCED) {
            localId = existing.id;
          } else {
            await db.quotes.update(existing.id, quoteData);
            localId = existing.id;
          }
        } else {
          localId = await db.quotes.add(quoteData as LocalQuote);
        }

        // Upsert items (solo para cotizaciones que no tienen cambios pendientes)
        const existingQuote = await db.quotes.get(localId);
        if (existingQuote?._syncStatus !== SyncStatus.SYNCED) continue;

        const items: any[] = (quote as any).items ?? [];
        for (const item of items) {
          const itemData = {
            serverId: item.id,
            quoteId: localId,
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
          // Buscar primero por serverId; si no existe, buscar por quoteId+productId
          // para actualizar items offline que aún no tienen serverId (evita duplicados)
          const existingItem = item.id
            ? (await db.quoteItems.where('serverId').equals(item.id).first()
               ?? await db.quoteItems
                    .where('quoteId').equals(localId)
                    .filter(i => i.productId === item.productId && !i.serverId)
                    .first())
            : null;
          if (existingItem?.id) {
            if (existingItem._syncStatus === SyncStatus.SYNCED) {
              await db.quoteItems.update(existingItem.id, itemData);
            }
          } else {
            // Solo agregar si no existe ya un item con el mismo serverId
            const dupCheck = item.id
              ? await db.quoteItems.where('serverId').equals(item.id).count()
              : 0;
            if (dupCheck === 0) await db.quoteItems.add(itemData as LocalQuoteItem);
          }
        }

        // Eliminar items huérfanos sin serverId — copias offline reemplazadas por los del servidor
        await db.quoteItems
          .where('quoteId').equals(localId)
          .filter(i => !i.serverId)
          .delete();
      }
    } catch { /* silent */ }
    finally {
      isSeedingQuotes = false;
      useUIStore.getState().finishSeedingStep('cotizaciones');
    }
  },

  retryConflictQuote: async (localId: number) => {
    // Resetear estado CONFLICT → PENDING_CREATE y limpiar intentos fallidos
    await db.quotes.update(localId, {
      _syncStatus: SyncStatus.PENDING_CREATE,
      _lastModifiedAt: Date.now(),
    });
    const queueEntry = await db.syncQueue
      .where('entityLocalId').equals(localId)
      .filter(e => e.entityType === 'quote')
      .first();
    if (queueEntry?.id) {
      await db.syncQueue.update(queueEntry.id, { attempts: 0, error: undefined, lastAttemptAt: undefined });
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentQuote: () => set({ currentQuote: null }),
}));
