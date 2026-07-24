import { apiService } from './api';
import { Order, CreateOrderRequest, UpdateOrderRequest, OrderFilters } from '../types/order';
import { PaginatedResponse, ApiResponse } from '../types';

export class OrderService {
  async getOrders(page = 1, limit = 10, filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    const params = { page, limit, ...filters };
    return apiService.get<PaginatedResponse<Order>>('/orders', params);
  }

  async getOrderById(id: number): Promise<Order> {
    const response = await apiService.get<ApiResponse<Order>>(`/orders/${id}`);
    return response.data;
  }

  async createOrder(data: CreateOrderRequest): Promise<Order> {
    const response = await apiService.post<ApiResponse<Order>>('/orders', data);
    return response.data;
  }

  async updateOrder(id: number, data: UpdateOrderRequest): Promise<Order> {
    const response = await apiService.put<ApiResponse<Order>>(`/orders/${id}`, data);
    return response.data;
  }

  async deleteOrder(id: number): Promise<void> {
    await apiService.delete(`/orders/${id}`);
  }

  async getOrdersByCustomer(customerId: number): Promise<Order[]> {
    const response = await apiService.get<ApiResponse<Order[]>>(`/orders/customer/${customerId}`);
    return response.data;
  }

  async getDeletedOrders(): Promise<Order[]> {
    const response = await apiService.get<ApiResponse<Order[]>>('/orders/trash');
    return response.data;
  }

  async restoreOrder(id: number): Promise<Order> {
    const response = await apiService.post<ApiResponse<Order>>(`/orders/${id}/restore`, {});
    return response.data;
  }

  async hardDeleteOrder(id: number): Promise<void> {
    await apiService.delete(`/orders/${id}/permanent`);
  }
}

export interface HomeStats {
  pendingOrders: number;
  salesThisMonth: number;
  ordersThisMonth: number;
  recentOrders: Array<{
    id: number;
    orderNumber: string;
    status: 'pending' | 'processing' | 'completed' | 'cancelled';
    totalAmount: number;
    createdAt: string;
    customer: { id: number; name: string } | null;
  }>;
}

export const orderService = new OrderService();

export async function getHomeStats(): Promise<HomeStats> {
  const response = await apiService.get<ApiResponse<HomeStats>>('/orders/stats/home');
  return response.data;
} 