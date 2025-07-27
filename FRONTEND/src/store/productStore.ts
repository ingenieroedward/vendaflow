import { create } from 'zustand';
import { Product, Price, PaginationInfo } from '../types';
import { productService } from '../services/products';

interface ProductState {
  products: Product[];
  currentProduct: Product | null;
  prices: Price[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo;
  searchQuery: string;
  
  // Actions
  searchProducts: (query: string,includePrices?:boolean) => Promise<void>;
  getProducts: (page?: number, limit?: number, includePrices?:boolean) => Promise<void>;
  getProductById: (id: number) => Promise<void>;
  getPricesByProduct: (productId: number) => Promise<void>;
  createProduct: (data: { name: string; code: string; unit: string; categoryId?: number | null }) => Promise<Product>;
  updateProduct: (id: number, data: { name: string; code: string; unit: string; categoryId?: number | null }) => Promise<Product>;
  setSearchQuery: (query: string) => void;
  clearError: () => void;
  clearCurrentProduct: () => void;
}

export const useProductStore = create<ProductState>((set) => ({
  products: [],
  currentProduct: null,
  prices: [],
  loading: false,
  error: null,
  pagination: {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  },
  searchQuery: '',

  searchProducts: async (query: string, includePrices=true) => {
    if (!query.trim()) {
      set({ products: [] });
      return;
    }

    set({ loading: true, error: null });
    try {
      const products = await productService.searchProducts(query,includePrices);
      set({ products, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  getProducts: async (page = 1, limit = 10, includePrices = true) => {
    set({ loading: true, error: null });
    try {
      const response = await productService.getProducts(page, limit, includePrices);
      set({
        products: response.data,
        pagination: response.pagination,
        loading: false,
      });
    } catch (error: unknown) {
      // Fallback to mock data if API fails
      console.log('API failed, using mock data for products', error);
    
    }
  },

 
  getProductById: async (id: number) => {
    set({ loading: true, error: null });
    try {
      const product = await productService.getProductById(id);
      set({ currentProduct: product, loading: false });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({ error: errorMessage, loading: false });
    }
  },

  getPricesByProduct: async (productId: number) => {
    set({ loading: true, error: null });
    try {
      const prices = await productService.getPricesByProduct(productId);
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
      const product = await productService.createProduct(data);
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
      const product = await productService.updateProduct(id, data);
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

  clearCurrentProduct: () => {
    set({ currentProduct: null, prices: [] });
  },
}));