/**
 * Background Sync Integration
 *
 * Integra el Background Sync API del Service Worker con el syncQueue de IndexedDB.
 * Permite sincronizar cambios offline cuando la conexión se restaura.
 *
 * SPEC-006: Service Worker Avanzado
 */

import { db, SyncQueueItem } from '../database/LocalDatabase';

const SYNC_TAG = 'sync-queue';
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 segundos

/**
 * Interfaz para el resultado de sincronización
 */
export interface SyncResult {
  success: boolean;
  processed: number;
  failed: number;
  errors: Array<{ itemId: number; error: string }>;
}

/**
 * Registra la sincronización en segundo plano
 * Usa la API nativa de Background Sync si está disponible
 */
export async function registerBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    console.warn('[BackgroundSync] Background Sync API no disponible');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(SYNC_TAG);
    console.log('[BackgroundSync] Sincronización en segundo plano registrada');
  } catch (error) {
    console.error('[BackgroundSync] Error al registrar sincronización:', error);

    // Fallback: sincronizar inmediatamente
    await syncNow();
  }
}

/**
 * Sincroniza ahora (sin esperar a Background Sync)
 * Procesa todos los items pendientes en la cola de sincronización
 */
export async function syncNow(): Promise<SyncResult> {
  console.log('[BackgroundSync] Iniciando sincronización manual...');

  const result: SyncResult = {
    success: true,
    processed: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Obtener todos los items pendientes de la cola
    const pendingItems = await db.syncQueue
      .filter((item) => !item.syncedAt && (!item.retries || item.retries < MAX_RETRIES))
      .toArray();

    console.log(`[BackgroundSync] ${pendingItems.length} items pendientes de sincronización`);

    if (pendingItems.length === 0) {
      return result;
    }

    // Procesar cada item
    for (const item of pendingItems) {
      try {
        await processSyncItem(item);
        result.processed++;

        // Marcar como sincronizado
        await db.syncQueue.update(item.id!, {
          syncedAt: Date.now(),
        });

        console.log(`[BackgroundSync] ✅ Item ${item.id} sincronizado (${item.operation} ${item.entity})`);
      } catch (error) {
        result.failed++;
        result.success = false;

        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        result.errors.push({
          itemId: item.id!,
          error: errorMessage,
        });

        // Incrementar contador de reintentos
        const retries = (item.retries || 0) + 1;
        await db.syncQueue.update(item.id!, {
          retries,
          lastError: errorMessage,
        });

        console.error(
          `[BackgroundSync] ❌ Error al sincronizar item ${item.id} (intento ${retries}/${MAX_RETRIES}):`,
          error
        );

        // Si alcanzó el máximo de reintentos, marcar como fallido
        if (retries >= MAX_RETRIES) {
          console.error(`[BackgroundSync] 🚫 Item ${item.id} alcanzó el máximo de reintentos`);
        }
      }
    }

    console.log(
      `[BackgroundSync] Sincronización completada: ${result.processed} exitosos, ${result.failed} fallidos`
    );
  } catch (error) {
    console.error('[BackgroundSync] Error general de sincronización:', error);
    result.success = false;
  }

  return result;
}

/**
 * Procesa un item individual de la cola de sincronización
 * Realiza la llamada HTTP correspondiente al servidor
 */
async function processSyncItem(item: SyncQueueItem): Promise<void> {
  const { entity, operation, entityId, data } = item;

  // Construir la URL de la API
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  let url = `${apiUrl}/${entity.toLowerCase()}s`;

  // Determinar método HTTP y URL según la operación
  let method: string;
  switch (operation) {
    case 'CREATE':
      method = 'POST';
      break;
    case 'UPDATE':
      method = 'PUT';
      url = `${url}/${entityId}`;
      break;
    case 'DELETE':
      method = 'DELETE';
      url = `${url}/${entityId}`;
      break;
    default:
      throw new Error(`Operación desconocida: ${operation}`);
  }

  // Obtener token de autenticación
  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('No hay token de autenticación');
  }

  // Realizar la solicitud HTTP
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: operation !== 'DELETE' ? JSON.stringify(data) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  // Para CREATE y UPDATE, actualizar el ID del servidor si es necesario
  if (operation === 'CREATE' || operation === 'UPDATE') {
    const serverData = await response.json();

    // Actualizar el registro local con datos del servidor
    // (esto se manejará en los repositories cuando procesen la respuesta)
    console.log('[BackgroundSync] Datos del servidor recibidos:', serverData);
  }
}

/**
 * Escucha eventos de conexión para sincronizar automáticamente
 */
export function setupAutoSync(): void {
  // Sincronizar cuando la app vuelve a estar online
  window.addEventListener('online', () => {
    console.log('[BackgroundSync] Conexión restaurada, sincronizando...');
    registerBackgroundSync();
  });

  // Escuchar mensajes del Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', async (event) => {
      const { type, payload } = event.data;

      switch (type) {
        case 'PROCESS_SYNC_QUEUE':
          // El Service Worker solicita que procesemos la cola de sincronización
          console.log('[BackgroundSync] Service Worker solicita procesar cola de sincronización');
          try {
            const result = await syncNow();

            // Notificar al Service Worker que terminamos
            if (event.source) {
              event.source.postMessage({
                type: 'SYNC_PROCESSED',
                payload: result,
              });
            }
          } catch (error) {
            console.error('[BackgroundSync] Error al procesar cola:', error);
            if (event.source) {
              event.source.postMessage({
                type: 'SYNC_PROCESSED',
                payload: {
                  success: false,
                  error: error instanceof Error ? error.message : 'Error desconocido',
                },
              });
            }
          }
          break;

        case 'SYNC_STARTED':
          console.log('[BackgroundSync] Sincronización iniciada por Service Worker');
          // Disparar evento personalizado
          window.dispatchEvent(new CustomEvent('sync-started'));
          break;

        case 'SYNC_COMPLETED':
          console.log('[BackgroundSync] Sincronización completada:', payload);
          // Disparar evento personalizado para que los componentes reaccionen
          window.dispatchEvent(new CustomEvent('sync-completed', { detail: payload }));
          break;

        case 'SYNC_FAILED':
          console.error('[BackgroundSync] Sincronización fallida:', payload);
          // Disparar evento de error
          window.dispatchEvent(new CustomEvent('sync-failed', { detail: payload }));
          break;

        default:
          break;
      }
    });
  }

  // Sincronización periódica (cada 5 minutos si hay items pendientes)
  setInterval(async () => {
    if (!navigator.onLine) {
      return;
    }

    const pendingCount = await db.syncQueue
      .filter((item) => !item.syncedAt && (!item.retries || item.retries < MAX_RETRIES))
      .count();

    if (pendingCount > 0) {
      console.log(`[BackgroundSync] Sincronización periódica: ${pendingCount} items pendientes`);
      await registerBackgroundSync();
    }
  }, 5 * 60 * 1000); // 5 minutos
}

/**
 * Obtiene estadísticas de la cola de sincronización
 */
export async function getSyncStats(): Promise<{
  pending: number;
  synced: number;
  failed: number;
  total: number;
}> {
  const allItems = await db.syncQueue.toArray();

  const pending = allItems.filter(
    (item) => !item.syncedAt && (!item.retries || item.retries < MAX_RETRIES)
  ).length;

  const synced = allItems.filter((item) => item.syncedAt).length;

  const failed = allItems.filter((item) => item.retries && item.retries >= MAX_RETRIES).length;

  return {
    pending,
    synced,
    failed,
    total: allItems.length,
  };
}

/**
 * Limpia items ya sincronizados de la cola
 */
export async function cleanSyncedItems(olderThanDays: number = 7): Promise<number> {
  const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

  const syncedItems = await db.syncQueue
    .filter((item) => item.syncedAt && item.syncedAt < cutoffTime)
    .toArray();

  await db.syncQueue.bulkDelete(syncedItems.map((item) => item.id!));

  console.log(`[BackgroundSync] Limpiados ${syncedItems.length} items sincronizados`);

  return syncedItems.length;
}

/**
 * Limpia items que alcanzaron el máximo de reintentos
 */
export async function cleanFailedItems(): Promise<number> {
  const failedItems = await db.syncQueue.filter((item) => item.retries && item.retries >= MAX_RETRIES).toArray();

  await db.syncQueue.bulkDelete(failedItems.map((item) => item.id!));

  console.log(`[BackgroundSync] Limpiados ${failedItems.length} items fallidos`);

  return failedItems.length;
}

/**
 * Reinicia items fallidos (resetea el contador de reintentos)
 */
export async function retryFailedItems(): Promise<number> {
  const failedItems = await db.syncQueue.filter((item) => item.retries && item.retries >= MAX_RETRIES).toArray();

  for (const item of failedItems) {
    await db.syncQueue.update(item.id!, {
      retries: 0,
      lastError: undefined,
    });
  }

  console.log(`[BackgroundSync] Reiniciados ${failedItems.length} items fallidos`);

  // Intentar sincronizar ahora
  if (navigator.onLine && failedItems.length > 0) {
    await registerBackgroundSync();
  }

  return failedItems.length;
}
