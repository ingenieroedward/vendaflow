import { apiService } from './api';
import { PurchaseOrder, CreatePurchaseOrderRequest, StockMovement } from '../types';
import { ApiResponse, PaginatedResponse } from '../types';

export class PurchaseOrderService {
  async getAll(page = 1, limit = 20): Promise<PaginatedResponse<PurchaseOrder>> {
    return apiService.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { page, limit });
  }

  async getById(id: number): Promise<PurchaseOrder> {
    const response = await apiService.get<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`);
    return response.data;
  }

  async create(data: CreatePurchaseOrderRequest): Promise<PurchaseOrder> {
    const response = await apiService.post<ApiResponse<PurchaseOrder>>('/purchase-orders', data);
    return response.data;
  }

  async update(id: number, data: Partial<CreatePurchaseOrderRequest> & { status?: string }): Promise<PurchaseOrder> {
    const response = await apiService.put<ApiResponse<PurchaseOrder>>(`/purchase-orders/${id}`, data);
    return response.data;
  }

  async markAsReceived(id: number): Promise<PurchaseOrder> {
    return this.update(id, { status: 'received' });
  }

  async delete(id: number): Promise<void> {
    await apiService.delete(`/purchase-orders/${id}`);
  }

  async getStockMovements(page = 1, limit = 20): Promise<PaginatedResponse<StockMovement>> {
    return apiService.get<PaginatedResponse<StockMovement>>('/stock-movements', { page, limit });
  }

  async getStockAlerts(): Promise<{ data: import('../types').Product[] }> {
    return apiService.get('/products/stock/alerts');
  }
}

export const purchaseOrderService = new PurchaseOrderService();
