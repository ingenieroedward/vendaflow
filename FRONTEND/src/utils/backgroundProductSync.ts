import { productService } from '../services/products';
import { customerService } from '../services/customers';
import { productRepository } from '../repositories/ProductRepository';
import { priceRepository } from '../repositories/PriceRepository';
import { supplierRepository } from '../repositories/SupplierRepository';
import { customerRepository } from '../repositories/CustomerRepository';
import { useSyncStore } from '../store/syncStore';
import { useAuthStore } from '../store/authStore';
import { db } from '../database/LocalDatabase';

const BATCH_SIZE = 50;
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

// ─────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────

/**
 * Guarda un lote de productos junto con sus precios y proveedores en IndexedDB.
 * Los precios vienen embedidos en la respuesta de /products/prices.
 */
async function saveBatch(products: any[]): Promise<void> {
  for (const product of products) {
    try {
      await productRepository.saveFromServer(product);

      if (product.prices && product.prices.length > 0) {
        for (const price of product.prices) {
          // Proveedor primero para no romper integridad referencial
          if (price.supplier) {
            await supplierRepository.saveFromServer(price.supplier).catch(() => {});
          }
          // Asegurar supplierId usando fallback a supplier.id si el backend lo devuelve null
          await priceRepository.saveFromServer({
            ...price,
            productId: product.id,
            supplierId: price.supplierId ?? price.supplier?.id,
          }).catch(() => {});
        }
      }
    } catch {
      // Continuar con el siguiente producto si falla uno
    }
  }
}

/**
 * Sincroniza proveedores que NO tienen precios asignados todavía.
 * Los que sí tienen precios ya se guardan dentro de saveBatch.
 */
async function syncSuppliers(): Promise<void> {
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await productService.getSuppliers(page, 100);
      for (const supplier of response.data) {
        await supplierRepository.saveFromServer(supplier).catch(() => {});
      }
      hasMore = page < (response.pagination?.totalPages ?? 1);
      page++;
    }
  } catch {
    // No bloquear el resto del sync si falla proveedores
  }
}

/**
 * Sincroniza todas las categorías en IndexedDB.
 * No existe CategoryRepository; usamos db.categories directamente.
 */
async function syncCategories(): Promise<void> {
  try {
    const categories = await productService.getCategories();
    for (const cat of categories) {
      const existing = await db.categories
        .where('serverId')
        .equals(cat.id)
        .first();

      const localData = {
        serverId: cat.id,
        name: cat.name,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt,
        deletedAt: cat.deletedAt ?? null,
        _syncStatus: 'synced' as const,
        _version: 1,
        _lastModifiedAt: Date.now(),
      };

      if (existing) {
        await db.categories.update(existing.id!, localData);
      } else {
        await db.categories.add(localData as any);
      }
    }
  } catch {
    // No bloquear el resto del sync si falla categorías
  }
}

/**
 * Sincroniza todos los clientes en IndexedDB.
 */
async function syncCustomers(): Promise<void> {
  try {
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await customerService.getCustomers(page, 100);
      for (const customer of response.data) {
        await customerRepository.saveFromServer(customer).catch(() => {});
      }
      hasMore = page < (response.pagination?.totalPages ?? 1);
      page++;
    }
  } catch {
    // No bloquear el resto del sync si falla clientes
  }
}

// ─────────────────────────────────────────────
// API pública
// ─────────────────────────────────────────────

/**
 * Sincroniza TODOS los datos necesarios en background por lotes.
 * Orden: categorías → proveedores → productos+precios → clientes
 *
 * @param force - Si true, ignora el cooldown de 1 hora (útil al reconectar)
 */
export async function syncAllProductsInBackground(force = false): Promise<void> {
  const { status, lastSync, setStatus, setProgress, setLastSync } = useSyncStore.getState();

  // Evitar sync concurrente
  if (status === 'syncing') return;

  // Cooldown de 1 hora (salvo force=true)
  if (!force && lastSync) {
    const elapsed = Date.now() - new Date(lastSync).getTime();
    if (elapsed < SYNC_INTERVAL_MS) return;
  }

  // Solo sincronizar con internet
  if (!navigator.onLine) return;

  try {
    setStatus('syncing');

    // ── 1. Categorías (rápido, sin progreso visual)
    await syncCategories();

    // ── 2. Proveedores completos (sin precios también)
    await syncSuppliers();

    // ── 3. Productos + precios: necesitamos el total para el progreso
    const firstPage = await productService.getProducts(1, BATCH_SIZE, true);
    const total = firstPage.pagination.total;
    const totalPages = firstPage.pagination.totalPages;

    setProgress(0, total);
    await saveBatch(firstPage.data);
    setProgress(Math.min(BATCH_SIZE, total), total);

    for (let page = 2; page <= totalPages; page++) {
      if (!navigator.onLine) break;
      await new Promise(resolve => setTimeout(resolve, 300)); // pausa cortés
      const batch = await productService.getProducts(page, BATCH_SIZE, true);
      await saveBatch(batch.data);
      setProgress(Math.min(page * BATCH_SIZE, total), total);
    }

    // ── 4. Clientes (sin bloquear al usuario)
    await syncCustomers();

    setStatus('done');
    setLastSync();
    setTimeout(() => useSyncStore.getState().reset(), 3000);

  } catch (error) {
    console.error('[BackgroundSync] Error sincronizando:', error);
    setStatus('error');
    setTimeout(() => useSyncStore.getState().reset(), 5000);
  }
}

/**
 * Inicializa el listener de reconexión para re-sincronizar automáticamente.
 * Retorna una función de cleanup para remover el listener (usar en useEffect).
 */
export function initOnlineSync(): () => void {
  const handleOnline = () => {
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) return;
    console.log('[BackgroundSync] Conexión restaurada, re-sincronizando...');
    // force=true: ignorar cooldown al reconectar para obtener cambios recientes
    syncAllProductsInBackground(true);
  };

  window.addEventListener('online', handleOnline);
  return () => window.removeEventListener('online', handleOnline);
}
