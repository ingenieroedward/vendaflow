import { apiService } from './api';
import { Customer, CreateCustomerRequest, UpdateCustomerRequest } from '../types/customer';
import { PaginatedResponse, ApiResponse } from '../types';

export class CustomerService {
  async getCustomers(page = 1, limit = 10): Promise<PaginatedResponse<Customer>> {
    const params = { page, limit };
    return apiService.get<PaginatedResponse<Customer>>('/customers', params);
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    const response = await apiService.get<ApiResponse<Customer[]>>(`/customers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }

  async getCustomerById(id: number): Promise<Customer> {
    const response = await apiService.get<ApiResponse<Customer>>(`/customers/${id}`);
    return response.data;
  }

  async createCustomer(data: CreateCustomerRequest): Promise<Customer> {
    const response = await apiService.post<ApiResponse<Customer>>('/customers', data);
    return response.data;
  }

  async updateCustomer(id: number, data: UpdateCustomerRequest): Promise<Customer> {
    const response = await apiService.put<ApiResponse<Customer>>(`/customers/${id}`, data);
    return response.data;
  }

  async deleteCustomer(id: number): Promise<void> {
    await apiService.delete(`/customers/${id}`);
  }

  async getDeletedCustomers(): Promise<Customer[]> {
    const response = await apiService.get<ApiResponse<Customer[]>>('/customers/trash');
    return response.data;
  }

  async restoreCustomer(id: number): Promise<Customer> {
    const response = await apiService.post<ApiResponse<Customer>>(`/customers/${id}/restore`, {});
    return response.data;
  }

  async hardDeleteCustomer(id: number): Promise<void> {
    await apiService.delete(`/customers/${id}/permanent`);
  }
}

export const customerService = new CustomerService(); 