import { create } from 'zustand';
import { Product, Price, PaginationInfo } from '../types';
import { productService } from '../services/products';

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
      const serverProducts = await productService.searchProducts(query, includePrices);
      set({ products: serverProducts.map(mapServerProduct), loading: false, error: null });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error al buscar productos';
      set({ error: errorMessage, loading: false });
    }
  },

  getProducts: async (page = 1, limit = 10, includePrices = true) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.getProducts(page, limit, includePrices);
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
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar productos';
      set({ error: errorMessage, loading: false });
    }
  },

  getProductById: async (id: number) => {
    set({ loading: true, error: null, currentProduct: null });
    try {
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

  setSearchQuery: (query: string) => set({ searchQuery: query }),
  clearError: () => set({ error: null }),
  clearCurrentProduct: () => set({ currentProduct: null, prices: [], pricesLoading: false, loading: false, error: null }),
  clearPriceComparison: () => set({ priceComparison: null }),
}));
