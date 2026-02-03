import { apiService } from './api';
import { 
  Product, 
  Price, 
  Supplier, 
  Category, 
  CreateProductRequest, 
  CreatePriceRequest,
  CreateSupplierRequest,
  CreateCategoryRequest,
  PaginatedResponse,
  ApiResponse 
} from '../types';

export class ProductService {
  // Products
  async searchProducts(query: string, includePrices: boolean = true): Promise<Product[]> {
    try {
      // Try the search endpoint first
      const endpoint = includePrices ? '/products/search/prices' : '/products/search';
      const response = await apiService.get<ApiResponse<Product[]>>(`${endpoint}?search=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      // Fallback: get all products and filter in frontend
      const response = await apiService.get<PaginatedResponse<Product>>('/products/prices', {
        page: 1,
        limit: 100, // Get more products for better search
      });

      const allProducts = response.data;
      const filteredProducts = allProducts.filter(product =>
        product.name.toLowerCase().includes(query.toLowerCase()) ||
        product.code.toLowerCase().includes(query.toLowerCase())
      );

      return filteredProducts;
    }
  }

  async getProducts(page = 1, limit = 10, includePrices = true): Promise<PaginatedResponse<Product>> {
    const params = { page, limit };
    const endpoint = includePrices ? '/products/prices' : '/products';
    return apiService.get<PaginatedResponse<Product>>(endpoint, params);
  }

  async getProductById(id: number): Promise<Product> {
    const response = await apiService.get<ApiResponse<Product>>(`/products/${id}`);
    return response.data;
  }

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const response = await apiService.post<ApiResponse<Product>>('/products', data);
    return response.data;
  }

  async updateProduct(id: number, data: Partial<CreateProductRequest>): Promise<Product> {
    const response = await apiService.put<ApiResponse<Product>>(`/products/${id}`, data);
    return response.data;
  }

  async deleteProduct(id: number): Promise<void> {
    await apiService.delete(`/products/${id}`);
  }

  // Prices
  async getPrices(page = 1, limit = 10): Promise<PaginatedResponse<Price>> {
    return apiService.get<PaginatedResponse<Price>>('/prices', { page, limit });
  }

  async getPricesByProduct(productId: number): Promise<Price[]> {
    const response = await apiService.get<ApiResponse<Price[]>>(`/prices/product/${productId}`);
    return response.data;
  }

  async getPriceById(id: number): Promise<Price> {
    const response = await apiService.get<ApiResponse<Price>>(`/prices/${id}`);
    return response.data;
  }

  async createPrice(data: CreatePriceRequest): Promise<Price> {
    const response = await apiService.post<ApiResponse<Price>>('/prices', data);
    return response.data;
  }

  async updatePrice(id: number, data: Partial<CreatePriceRequest>): Promise<Price> {
    const response = await apiService.put<ApiResponse<Price>>(`/prices/${id}`, data);
    return response.data;
  }

  async deletePrice(id: number): Promise<void> {
    await apiService.delete(`/prices/${id}`);
  }

  // Suppliers
  async getSuppliers(page = 1, limit = 10): Promise<PaginatedResponse<Supplier>> {
    return apiService.get<PaginatedResponse<Supplier>>('/suppliers', { page, limit });
  }

  async getSupplierById(id: number): Promise<Supplier> {
    const response = await apiService.get<ApiResponse<Supplier>>(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: CreateSupplierRequest): Promise<Supplier> {
    const response = await apiService.post<ApiResponse<Supplier>>('/suppliers', data);
    return response.data;
  }

  async updateSupplier(id: number, data: Partial<CreateSupplierRequest>): Promise<Supplier> {
    const response = await apiService.put<ApiResponse<Supplier>>(`/suppliers/${id}`, data);
    return response.data;
  }

  async deleteSupplier(id: number): Promise<void> {
    await apiService.delete(`/suppliers/${id}`);
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    const response = await apiService.get<ApiResponse<Category[]>>('/categories');
    return response.data;
  }

  async getCategoryById(id: number): Promise<Category> {
    const response = await apiService.get<ApiResponse<Category>>(`/categories/${id}`);
    return response.data;
  }

  async createCategory(data: CreateCategoryRequest): Promise<Category> {
    const response = await apiService.post<ApiResponse<Category>>('/categories', data);
    return response.data;
  }

  async updateCategory(id: number, data: Partial<CreateCategoryRequest>): Promise<Category> {
    const response = await apiService.put<ApiResponse<Category>>(`/categories/${id}`, data);
    return response.data;
  }

  async deleteCategory(id: number): Promise<void> {
    await apiService.delete(`/categories/${id}`);
  }
}

export const productService = new ProductService();