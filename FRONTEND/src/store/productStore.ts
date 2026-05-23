import { create } from 'zustand';
import { Product, Price, PaginationInfo } from '../types';
import { productService } from '../services/products';
import { db, LocalProduct, SyncStatus } from '../database/LocalDatabase';
import { useUIStore } from './uiStore';

import type { LocalPrice, LocalSupplier } from '../database/LocalDatabase';

const mapLocalToProduct = (p: LocalProduct, prices: Price[] = []): Product => ({
  id: p.serverId ?? p.id!,
  name: p.name,
  code: p.code,
  unit: p.unit,
  salePrice: p.salePrice,
  categoryId: p.categoryId ?? null,
  createdAt: p.createdAt ?? new Date().toISOString(),
  updatedAt: p.updatedAt ?? new Date().toISOString(),
  prices,
} as Product);

// Batch-optimized: builds prices from pre-loaded maps (O(1) per product)
function mapProductWithMaps(
  p: LocalProduct,
  pricesByProductId: Map<number, LocalPrice[]>,
  supplierByServerId: Map<number, LocalSupplier>,
): Product {
  const prodId = p.serverId ?? p.id!;
  const localPrices = pricesByProductId.get(prodId) ?? [];
  const prices: Price[] = localPrices.map(lp => {
    const s = supplierByServerId.get(lp.supplierId);
    return {
      id: lp.serverId ?? lp.id!,
      productId: prodId,
      supplierId: lp.supplierId,
      price: lp.price,
      updatedByUserId: lp.updatedByUserId,
      createdAt: lp.createdAt ?? '',
      updatedAt: lp.updatedAt ?? '',
      supplier: s ? { id: s.serverId ?? s.id!, name: s.name, contact: s.contact, location: s.location } : undefined,
    };
  });
  return mapLocalToProduct(p, prices);
}

// Loads all prices+suppliers once, then maps a list of products efficiently
async function mapProductsBatch(locals: LocalProduct[]): Promise<Product[]> {
  if (locals.length === 0) return [];
  const [allPrices, allSuppliers] = await Promise.all([
    db.prices.filter(lp => !lp.deletedAt).toArray(),
    db.suppliers.filter(s => !s.deletedAt).toArray(),
  ]);
  const pricesByProductId = new Map<number, LocalPrice[]>();
  for (const lp of allPrices) {
    const pid = lp.productId;
    if (pid == null) continue;
    const arr = pricesByProductId.get(pid);
    if (arr) arr.push(lp);
    else pricesByProductId.set(pid, [lp]);
  }
  const supplierByServerId = new Map<number, LocalSupplier>(
    allSuppliers.filter(s => s.serverId != null).map(s => [s.serverId!, s])
  );
  return locals.map(p => mapProductWithMaps(p, pricesByProductId, supplierByServerId));
}

// Single-product path (used by getProductById) — still async per-lookup, only 1 product
async function mapLocalToProductWithPrices(p: LocalProduct): Promise<Product> {
  const results = await mapProductsBatch([p]);
  return results[0];
}

interface PriceComparisonResult {
  productId: number;
  productName: string;
  prices: Price[];
  bestPrice: Price | null;
}

interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  prices: Price[];
  priceComparison: PriceComparisonResult | null;
  loading: boolean;
  pricesLoading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  searchQuery: string;

  // Product Actions
  searchProducts: (query: string, includePrices?: boolean) => Promise<void>;
  getProducts: (page?: number, limit?: number, includePrices?: boolean) => Promise<void>;
  getProductById: (id: number) => Promise<void>;
  createProduct: (data: { name: string; code: string; unit: string; salePrice: number; categoryId?: number | null }) => Promise<Product>;
  updateProduct: (id: number, data: { name: string; code: string; unit: string; salePrice: number; categoryId?: number | null }) => Promise<Product>;
  deleteProduct: (id: number) => Promise<void>;

  // Price Actions
  getPricesByProduct: (productId: number) => Promise<void>;
  createPrice: (data: { productId: number; supplierId: number; price: number; updatedByUserId: number }) => Promise<Price>;
  updatePrice: (id: number, data: { price: number; updatedByUserId: number }) => Promise<Price>;
  deletePrice: (id: number) => Promise<void>;
  compareSuppliers: (productId: number) => Promise<void>;
  bulkUpdatePrices: (prices: Array<{ id: number; price: number; updatedByUserId: number }>) => Promise<number>;

  // Utilities
  seedAllProducts: () => Promise<void>;
  seedPricesData: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  clearCurrentProduct: () => void;
  clearPriceComparison: () => void;
}

const mapServerProduct = (p: any): Product => ({
  id: p.id,
  name: p.name,
  code: p.code,
  unit: p.unit,
  salePrice: p.salePrice,
  categoryId: p.categoryId || null,
  category: p.category,
  createdAt: p.createdAt || new Date().toISOString(),
  updatedAt: p.updatedAt || new Date().toISOString(),
  prices: p.prices?.map((pr: any) => ({
    id: pr.id,
    productId: pr.productId ?? p.id,
    supplierId: pr.supplierId ?? pr.supplier?.id,
    price: pr.price,
    updatedByUserId: pr.updatedByUserId,
    createdAt: pr.createdAt || new Date().toISOString(),
    updatedAt: pr.updatedAt || new Date().toISOString(),
    supplier: pr.supplier ? {
      id: pr.supplier.id,
      name: pr.supplier.name,
      contact: pr.supplier.contact,
      location: pr.supplier.location,
    } : undefined,
  })) || [],
});

const mapServerPrice = (p: any): Price => ({
  id: p.id,
  productId: p.productId,
  supplierId: p.supplierId ?? p.supplier?.id,
  price: p.price,
  updatedByUserId: p.updatedByUserId,
  updatedByUser: p.updatedByUser ? { id: p.updatedByUser.id, username: p.updatedByUser.username } : undefined,
  createdAt: p.createdAt || new Date().toISOString(),
  updatedAt: p.updatedAt || new Date().toISOString(),
  supplier: p.supplier ? {
    id: p.supplier.id,
    name: p.supplier.name,
    contact: p.supplier.contact,
    location: p.supplier.location,
  } : undefined,
});

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  currentProduct: null,
  prices: [],
  priceComparison: null,
  loading: false,
  pricesLoading: false,
  error: null,
  pagination: { total: 0, page: 1, limit: 10, totalPages: 0 },
  searchQuery: '',

  searchProducts: async (query: string, includePrices = true) => {
    if (!query.trim()) {
      set({ products: [] });
      return;
    }
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const term = query.toLowerCase();
        const local = await db.products
          .filter(p => !p.deletedAt && (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)))
          .toArray();
        const products = await mapProductsBatch(local);
        set({ products, loading: false, error: null });
        return;
      }
      const serverProducts = await productService.searchProducts(query, includePrices);
      set({ products: serverProducts.map(mapServerProduct), loading: false, error: null });
    } catch (error: unknown) {
      try {
        const term = query.toLowerCase();
        const local = await db.products
          .filter(p => !p.deletedAt && (p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term)))
          .toArray();
        const products = await mapProductsBatch(local);
        set({ products, loading: false, error: null });
      } catch {
        const errorMessage = error instanceof Error ? error.message : 'Error al buscar productos';
        set({ error: errorMessage, loading: false });
      }
    }
  },

  getProducts: async (page = 1, limit = 10, includePrices = false) => {
    set({ loading: true, error: null });
    try {
      if (!navigator.onLine) {
        const local = await db.products.filter(p => !p.deletedAt).toArray();
        const products = await mapProductsBatch(local);
        set({
          products,
          pagination: { total: local.length, page: 1, limit: local.length, totalPages: 1 },
          loading: false, error: null,
        });
        return;
      }
      const response = await productService.getProducts(page, limit, includePrices);
      // Seed a Dexie para disponibilidad offline
      if (response.data?.length) {
        await db.transaction('rw', db.products, async () => {
          for (const p of response.data) {
            const existing = await db.products.where('serverId').equals(p.id).first();
            if (existing?.id) {
              await db.products.update(existing.id, {
                name: p.name, code: p.code, unit: p.unit,
                salePrice: p.salePrice, categoryId: p.categoryId ?? undefined,
                updatedAt: p.updatedAt, _syncStatus: 'synced' as const,
              });
            } else {
              await db.products.add({
                serverId: p.id, name: p.name, code: p.code, unit: p.unit,
                salePrice: p.salePrice, categoryId: p.categoryId ?? undefined,
                createdAt: p.createdAt, updatedAt: p.updatedAt,
                _syncStatus: 'synced' as const, _version: 1, _lastModifiedAt: Date.now(),
              } as LocalProduct);
            }
          }
        });
      }
      set({
        products: response.data.map(mapServerProduct),
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
      // Fallback a Dexie si la API falla
      try {
        const local = await db.products.filter(p => !p.deletedAt).toArray();
        if (local.length > 0) {
          const products = await mapProductsBatch(local);
          set({ products, loading: false, error: null });
          return;
        }
      } catch { /* ignorar */ }
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar productos';
      set({ error: errorMessage, loading: false });
    }
  },

  getProductById: async (id: number) => {
    set({ loading: true, error: null, currentProduct: null });
    try {
      if (!navigator.onLine) {
        const local = await db.products.get(id) ?? await db.products.where('serverId').equals(id).first();
        if (local) { set({ currentProduct: await mapLocalToProductWithPrices(local), loading: false }); return; }
        throw new Error('Producto no disponible sin conexión');
      }
      const serverProduct = await productService.getProductById(id);
      set({ currentProduct: mapServerProduct(serverProduct), loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar producto';
      set({ error: errorMessage, loading: false });
    }
  },

  getPricesByProduct: async (productId: number) => {
    set({ pricesLoading: true, prices: [], error: null });
    try {
      const serverPrices = await productService.getPricesByProduct(productId);
      set({ prices: serverPrices.map(mapServerPrice), pricesLoading: false });
    } catch (error: unknown) {
      console.warn('Error cargando precios:', error);
      set({ prices: [], pricesLoading: false });
    }
  },

  createProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      const product = await productService.createProduct({
        name: data.name,
        code: data.code,
        unit: data.unit,
        salePrice: data.salePrice,
        categoryId: data.categoryId ?? undefined,
      });
      set({ loading: false });
      return mapServerProduct(product);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear producto';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateProduct: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const product = await productService.updateProduct(id, {
        name: data.name,
        code: data.code,
        unit: data.unit,
        salePrice: data.salePrice,
        categoryId: data.categoryId ?? undefined,
      });
      const mapped = mapServerProduct(product);
      set(state => ({
        products: state.products.map(p => p.id === id ? mapped : p),
        currentProduct: state.currentProduct?.id === id ? mapped : state.currentProduct,
        loading: false,
      }));
      return mapped;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar producto';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteProduct: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await productService.deleteProduct(id);
      set(state => ({
        products: state.products.filter(p => p.id !== id),
        currentProduct: state.currentProduct?.id === id ? null : state.currentProduct,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar producto';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  createPrice: async (data) => {
    set({ loading: true, error: null });
    try {
      const price = await productService.createPrice(data);
      const mapped = mapServerPrice(price);
      set(state => ({ prices: [...state.prices, mapped], loading: false }));
      return mapped;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updatePrice: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const price = await productService.updatePrice(id, data);
      const mapped = mapServerPrice(price);
      set(state => ({
        prices: state.prices.map(p => p.id === id ? mapped : p),
        loading: false,
      }));
      return mapped;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deletePrice: async (id: number) => {
    set({ loading: true, error: null });
    try {
      await productService.deletePrice(id);
      set(state => ({ prices: state.prices.filter(p => p.id !== id), loading: false }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  compareSuppliers: async (productId: number) => {
    set({ loading: true, error: null });
    try {
      const serverPrices = await productService.getPricesByProduct(productId);
      const prices = serverPrices.map(mapServerPrice);
      const bestPrice = prices.length > 0
        ? prices.reduce((min, p) => p.price < min.price ? p : min, prices[0])
        : null;
      const product = await productService.getProductById(productId);
      set({
        priceComparison: {
          productId,
          productName: product.name,
          prices,
          bestPrice,
        },
        loading: false,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al comparar proveedores';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  bulkUpdatePrices: async (prices) => {
    set({ loading: true, error: null });
    try {
      await Promise.all(prices.map(p => productService.updatePrice(p.id, { price: p.price, updatedByUserId: p.updatedByUserId })));
      set({ loading: false });
      return prices.length;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar precios';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  seedAllProducts: async () => {
    if (!navigator.onLine) return;
    useUIStore.getState().startSeedingStep('productos');
    try {
      const response = await productService.getProducts(1, 2000, false);
      if (!response.data?.length) return;
      await db.transaction('rw', db.products, async () => {
        for (const p of response.data) {
          const existing = await db.products.where('serverId').equals(p.id).first();
          if (existing?.id) {
            if (existing._syncStatus !== SyncStatus.SYNCED) continue; // no sobreescribir pendientes
            await db.products.update(existing.id, {
              name: p.name, code: p.code, unit: p.unit,
              salePrice: p.salePrice, categoryId: p.categoryId ?? undefined,
              updatedAt: p.updatedAt, _syncStatus: 'synced' as const,
            });
          } else {
            await db.products.add({
              serverId: p.id, name: p.name, code: p.code, unit: p.unit,
              salePrice: p.salePrice, categoryId: p.categoryId ?? undefined,
              createdAt: p.createdAt, updatedAt: p.updatedAt,
              _syncStatus: 'synced' as const, _version: 1, _lastModifiedAt: Date.now(),
            } as LocalProduct);
          }
        }
      });
    } catch { /* silent — solo seed de respaldo */ }
    useUIStore.getState().finishSeedingStep('productos');
  },

  seedPricesData: async () => {
    if (!navigator.onLine) return;
    useUIStore.getState().startSeedingStep('precios y proveedores');
    try {
      const [prodRes, supRes] = await Promise.all([
        productService.getProducts(1, 2000, true),
        productService.getSuppliers(1, 2000),
      ]);

      // Seed suppliers
      const suppliers = supRes.data ?? [];
      if (suppliers.length) {
        await db.transaction('rw', db.suppliers, async () => {
          for (const s of suppliers) {
            const existing = await db.suppliers.where('serverId').equals(s.id).first();
            const data = {
              serverId: s.id, name: s.name,
              contact: s.contact ?? '', location: s.location ?? '',
              createdAt: s.createdAt, updatedAt: s.updatedAt,
              _syncStatus: 'synced' as const, _version: 1, _lastModifiedAt: Date.now(),
            };
            if (existing?.id) await db.suppliers.update(existing.id, data);
            else await db.suppliers.add(data as any);
          }
        });
      }

      // Seed prices extracted from products — derive productId/supplierId from parent context
      // because older backend responses may omit these fields
      const allPrices = (prodRes.data as any[]).flatMap((product: any) =>
        (product.prices ?? []).map((price: any) => ({
          ...price,
          productId: price.productId ?? product.id,
          supplierId: price.supplierId ?? price.supplier?.id,
        }))
      );
      if (allPrices.length) {
        await db.transaction('rw', db.prices, async () => {
          for (const p of allPrices) {
            if (!p.productId || !p.supplierId) continue; // skip incomplete records
            const existing = await db.prices.where('serverId').equals(p.id).first();
            const data = {
              serverId: p.id, productId: p.productId, supplierId: p.supplierId,
              price: p.price, updatedByUserId: p.updatedByUserId ?? 0,
              createdAt: p.createdAt ?? new Date().toISOString(),
              updatedAt: p.updatedAt ?? new Date().toISOString(),
              _syncStatus: 'synced' as const, _version: 1, _lastModifiedAt: Date.now(),
            };
            if (existing?.id) await db.prices.update(existing.id, data);
            else await db.prices.add(data as any);
          }
        });
      }
    } catch { /* silent */ }
    useUIStore.getState().finishSeedingStep('precios y proveedores');
  },

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  clearError: () => set({ error: null }),
  clearCurrentProduct: () => set({ currentProduct: null, prices: [], pricesLoading: false, loading: false, error: null }),
  clearPriceComparison: () => set({ priceComparison: null }),
}));
