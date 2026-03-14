import { create } from 'zustand';
import { Product, Price, PaginationInfo } from '../types';
import { productService } from '../services/products';
import { productRepository } from '../repositories/ProductRepository';
import { priceRepository, PriceComparisonResult } from '../repositories/PriceRepository';
import { LocalProduct, LocalPrice } from '../database/LocalDatabase';
import { CreateProductDTO, CreatePriceDTO } from '../database/models';
import { useAuthStore } from './authStore';

interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  prices: Price[];
  priceComparison: PriceComparisonResult | null;
  loading: boolean;
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
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  clearCurrentProduct: () => void;
  clearPriceComparison: () => void;
}

// Helper to convert LocalProduct to Product (for backward compatibility)
const toProduct = (local: LocalProduct, prices?: LocalPrice[]): Product => ({
  id: local.id!,
  name: local.name,
  code: local.code,
  unit: local.unit,
  salePrice: local.salePrice,
  categoryId: local.categoryId || null,
  createdAt: local.createdAt || new Date().toISOString(),
  updatedAt: local.updatedAt || new Date().toISOString(),
  prices: prices?.map(toPrice),
});

// Helper to convert LocalPrice to Price (for backward compatibility)
const toPrice = (local: LocalPrice & { supplier?: any }): Price => ({
  id: local.id!,
  productId: local.productId,
  supplierId: local.supplierId,
  price: local.price,
  updatedByUserId: local.updatedByUserId,
  createdAt: local.createdAt || new Date().toISOString(),
  updatedAt: local.updatedAt || new Date().toISOString(),
  supplier: local.supplier ? {
    id: local.supplier.id || local.supplier.serverId,
    name: local.supplier.name,
    contact: local.supplier.contact,
    location: local.supplier.location
  } : undefined,
});

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  currentProduct: null,
  prices: [],
  priceComparison: null,
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },
  searchQuery: '',

  searchProducts: async (query: string, includePrices = true) => {
    if (!query.trim()) {
      set({ products: [] });
      return;
    }

    set({ loading: true, error: null });
    try {
      // If online, search via server API
      if (navigator.onLine) {
        try {
          console.log(`🔍 Searching "${query}" on server...`);
          const serverProducts = await productService.searchProducts(query, includePrices);

          // Convert server response to Product format
          const products = serverProducts.map((serverProduct) => ({
            id: serverProduct.id,
            name: serverProduct.name,
            code: serverProduct.code,
            unit: serverProduct.unit,
            salePrice: serverProduct.salePrice,
            categoryId: serverProduct.categoryId || null,
            createdAt: serverProduct.createdAt || new Date().toISOString(),
            updatedAt: serverProduct.updatedAt || new Date().toISOString(),
            prices: serverProduct.prices?.map((p: any) => ({
              id: p.id,
              productId: p.productId,
              supplierId: p.supplierId,
              price: p.price,
              updatedByUserId: p.updatedByUserId,
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
              supplier: p.supplier ? {
                id: p.supplier.id,
                name: p.supplier.name,
                contact: p.supplier.contact,
                location: p.supplier.location
              } : undefined,
            })) || [],
          }));

          set({ products, loading: false, error: null });
          return;
        } catch (apiError) {
          console.warn('⚠️ Server search failed, falling back to local:', apiError);
          // Fall through to local search
        }
      }

      // Offline or server failed: search in local DB
      console.log(`🔍 Searching "${query}" in local DB...`);
      if (includePrices) {
        const results = await productRepository.searchWithPrices(query);
        const products = results.map(r => toProduct(r.product, r.prices));
        set({ products, loading: false, error: null });
      } else {
        const localProducts = await productRepository.search(query);
        const products = localProducts.map(p => toProduct(p));
        set({ products, loading: false, error: null });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Search error:', errorMessage);
      set({ error: errorMessage, loading: false });
    }
  },

  getProducts: async (page = 1, limit = 10, includePrices = true) => {
    set({ loading: true, error: null });
    try {
      // If online, fetch from server API with pagination (server handles pagination)
      if (navigator.onLine) {
        try {
          console.log(`📥 Fetching page ${page} from server...`);
          const userId = useAuthStore.getState().user?.id;

          // Fetch from server API with pagination
          const response = await productService.getProducts(page, limit, includePrices);

          // Save fetched products to local DB for offline caching
          if (response.data && response.data.length > 0) {
            console.log(`💾 Caching ${response.data.length} products to local DB...`);

            // Import price and supplier repositories
            const { priceRepository } = await import('../repositories/PriceRepository');
            const { supplierRepository } = await import('../repositories/SupplierRepository');

            for (const serverProduct of response.data) {
              try {
                // Save product
                const savedProduct = await productRepository.saveFromServer(serverProduct, userId);

                // Save prices and suppliers if present
                if (serverProduct.prices && serverProduct.prices.length > 0) {
                  for (const serverPrice of serverProduct.prices) {
                    // Save supplier if present
                    if (serverPrice.supplier) {
                      await supplierRepository.saveFromServer(serverPrice.supplier, userId);
                    }

                    // Save price with correct productId (server's productId)
                    const priceToSave = {
                      ...serverPrice,
                      productId: savedProduct.serverId || serverProduct.id
                    };
                    await priceRepository.saveFromServer(priceToSave, userId);
                  }
                }
              } catch (err) {
                console.warn('Failed to cache product:', serverProduct.code, err);
              }
            }
          }

          // Convert server response to Product format (already has prices from server)
          const products = response.data.map((serverProduct) => ({
            id: serverProduct.id,
            name: serverProduct.name,
            code: serverProduct.code,
            unit: serverProduct.unit,
            salePrice: serverProduct.salePrice,
            categoryId: serverProduct.categoryId || null,
            createdAt: serverProduct.createdAt || new Date().toISOString(),
            updatedAt: serverProduct.updatedAt || new Date().toISOString(),
            prices: serverProduct.prices?.map((p: any) => ({
              id: p.id,
              productId: p.productId,
              supplierId: p.supplierId,
              price: p.price,
              updatedByUserId: p.updatedByUserId,
              createdAt: p.createdAt || new Date().toISOString(),
              updatedAt: p.updatedAt || new Date().toISOString(),
              supplier: p.supplier ? {
                id: p.supplier.id,
                name: p.supplier.name,
                contact: p.supplier.contact,
                location: p.supplier.location
              } : undefined,
            })) || [],
          }));

          set({
            products,
            pagination: {
              total: response.pagination?.total || 0,
              page: response.pagination?.page || page,
              limit: response.pagination?.limit || limit,
              totalPages: response.pagination?.totalPages || Math.ceil((response.pagination?.total || 0) / limit),
            },
            loading: false,
            error: null,
          });
          return;
        } catch (apiError) {
          console.warn('⚠️ Failed to fetch from server, falling back to local data:', apiError);
          // Fall through to use local DB
        }
      }

      // Offline or server failed: use local DB with client-side pagination
      console.log('📴 Using local DB for products...');
      const localProductsWithPrices = includePrices
        ? await productRepository.getAllWithPrices()
        : (await productRepository.getAll()).map(p => ({ product: p, prices: [] }));

      // Apply client-side pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedProducts = localProductsWithPrices.slice(startIndex, endIndex);

      const products = paginatedProducts.map(p => toProduct(p.product, p.prices));

      set({
        products,
        pagination: {
          total: localProductsWithPrices.length,
          page,
          limit,
          totalPages: Math.ceil(localProductsWithPrices.length / limit),
        },
        loading: false,
        error: localProductsWithPrices.length === 0 ? 'Sin conexión. No hay datos disponibles offline.' : null,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      console.error('❌ Critical error loading products:', errorMessage);
      set({ error: errorMessage, loading: false });
    }
  },

 
  getProductById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      // If online, fetch from server API
      if (navigator.onLine) {
        try {
          const serverProduct = await productService.getProductById(id);
          const product: Product = {
            id: serverProduct.id,
            name: serverProduct.name,
            code: serverProduct.code,
            unit: serverProduct.unit,
            salePrice: serverProduct.salePrice,
            categoryId: serverProduct.categoryId || null,
            category: serverProduct.category,
            createdAt: serverProduct.createdAt || new Date().toISOString(),
            updatedAt: serverProduct.updatedAt || new Date().toISOString(),
          };
          // Cache-on-visit: guardar en IndexedDB para acceso offline futuro
          productRepository.saveFromServer(serverProduct).catch(() => {});
          set({ currentProduct: product, loading: false });
          return;
        } catch (apiError) {
          console.warn('⚠️ Failed to fetch product from server, trying local DB:', apiError);
        }
      }

      // Offline or server failed: try local DB by serverId
      const localProduct = await productRepository.getByServerId(id);
      if (!localProduct) {
        throw new Error('Producto no encontrado');
      }
      const product = toProduct(localProduct);
      set({ currentProduct: product, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  getPricesByProduct: async (productId: number) => {
    set({ loading: true, error: null });
    try {
      // If online, fetch from server API
      if (navigator.onLine) {
        try {
          const serverPrices = await productService.getPricesByProduct(productId);
          const prices: Price[] = serverPrices.map((p) => ({
            id: p.id,
            productId: p.productId,
            supplierId: p.supplierId,
            price: p.price,
            updatedByUserId: p.updatedByUserId,
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString(),
            supplier: p.supplier ? {
              id: p.supplier.id,
              name: p.supplier.name,
              contact: p.supplier.contact,
              location: p.supplier.location,
            } : undefined,
          }));
          // Cache-on-visit: guardar precios en IndexedDB para acceso offline futuro
          serverPrices.forEach(p => priceRepository.saveFromServer(p).catch(() => {}));
          set({ prices, loading: false });
          return;
        } catch (apiError) {
          console.warn('⚠️ Failed to fetch prices from server, trying local DB:', apiError);
        }
      }

      // Offline or server failed: try local DB
      // First find the product by serverId to get local prices
      const localProduct = await productRepository.getByServerId(productId);
      if (!localProduct) {
        set({ prices: [], loading: false });
        return;
      }

      const result = await productRepository.getWithPricesByServerId(productId);
      if (!result) {
        set({ prices: [], loading: false });
        return;
      }
      const prices = result.prices.map(toPrice);
      set({ prices, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
  },

  clearError: () => {
    set({ error: null });
  },

  createProduct: async (data) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID from auth store
      const userId = useAuthStore.getState().user?.id;

      // Create product in local DB with sync queue
      const productData: CreateProductDTO = {
        name: data.name,
        code: data.code,
        unit: data.unit,
        salePrice: data.salePrice,
        categoryId: data.categoryId || undefined,
      };

      const localProduct = await productRepository.createLocal(productData, userId);
      const product = toProduct(localProduct);

      set({ loading: false });
      return product;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updateProduct: async (id, data) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID from auth store
      const userId = useAuthStore.getState().user?.id;

      // Update product in local DB with sync queue
      const updates: Partial<CreateProductDTO> = {
        name: data.name,
        code: data.code,
        unit: data.unit,
        salePrice: data.salePrice,
        categoryId: data.categoryId || undefined,
      };

      const localProduct = await productRepository.updateLocal(id, updates, userId);
      const product = toProduct(localProduct);

      set(state => ({
        products: state.products.map(p => p.id === id ? product : p),
        currentProduct: state.currentProduct?.id === id ? product : state.currentProduct,
        loading: false,
      }));
      return product;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteProduct: async (id: number) => {
    set({ loading: true, error: null });
    try {
      // Get current user ID from auth store
      const userId = useAuthStore.getState().user?.id;

      // Soft delete product in local DB with sync queue
      await productRepository.deleteLocal(id, userId);

      set(state => ({
        products: state.products.filter(p => p.id !== id),
        currentProduct: state.currentProduct?.id === id ? null : state.currentProduct,
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  clearCurrentProduct: () => {
    set({ currentProduct: null, prices: [] });
  },

  clearPriceComparison: () => {
    set({ priceComparison: null });
  },

  // Price management methods

  createPrice: async (data) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;

      const priceDTO: CreatePriceDTO = {
        productId: data.productId,
        supplierId: data.supplierId,
        price: data.price,
        updatedByUserId: data.updatedByUserId
      };

      const localPrice = await priceRepository.createLocal(priceDTO, userId);
      const price = toPrice(localPrice);

      set(state => ({
        prices: [...state.prices, price],
        loading: false,
      }));

      return price;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al crear precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  updatePrice: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;

      const localPrice = await priceRepository.updateLocal(id, data, userId);
      const price = toPrice(localPrice);

      set(state => ({
        prices: state.prices.map(p => p.id === id ? price : p),
        loading: false,
      }));

      return price;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deletePrice: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      await priceRepository.deleteLocal(id, userId);

      set(state => ({
        prices: state.prices.filter(p => p.id !== id),
        loading: false,
      }));
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al eliminar precio';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  compareSuppliers: async (productId: number) => {
    set({ loading: true, error: null });
    try {
      const comparison = await priceRepository.compareSuppliers(productId);

      if (!comparison) {
        throw new Error('No se encontraron precios para comparar');
      }

      set({ priceComparison: comparison, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al comparar proveedores';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  bulkUpdatePrices: async (prices) => {
    set({ loading: true, error: null });
    try {
      const userId = useAuthStore.getState().user?.id;
      const updatedCount = await priceRepository.bulkUpdatePrices(prices, userId);

      // Refresh prices if we're currently viewing a product
      // This could be improved by refreshing only affected prices
      set({ loading: false });

      return updatedCount;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar precios';
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },
}));