import { apiService } from './api';
import { Quote, CreateQuoteRequest, UpdateQuoteRequest, QuoteFilters } from '../types/quote';
import { Order } from '../types/order';
import { PaginatedResponse, ApiResponse } from '../types';

export class QuoteService {
  async getQuotes(page = 1, limit = 10, filters?: QuoteFilters): Promise<PaginatedResponse<Quote>> {
    const params = { page, limit, ...filters };
    return apiService.get<PaginatedResponse<Quote>>('/quotes', params);
  }

  async getQuoteById(id: number): Promise<Quote> {
    const response = await apiService.get<ApiResponse<Quote>>(`/quotes/${id}`);
    return response.data;
  }

  async createQuote(data: CreateQuoteRequest): Promise<Quote> {
    const response = await apiService.post<ApiResponse<Quote>>('/quotes', data);
    return response.data;
  }

  async updateQuote(id: number, data: UpdateQuoteRequest): Promise<Quote> {
    const response = await apiService.put<ApiResponse<Quote>>(`/quotes/${id}`, data);
    return response.data;
  }

  async deleteQuote(id: number): Promise<void> {
    await apiService.delete(`/quotes/${id}`);
  }

  async getQuotesByCustomer(customerId: number): Promise<Quote[]> {
    const response = await apiService.get<ApiResponse<Quote[]>>(`/quotes/customer/${customerId}`);
    return response.data;
  }

  async getDeletedQuotes(): Promise<Quote[]> {
    const response = await apiService.get<ApiResponse<Quote[]>>('/quotes/trash');
    return response.data;
  }

  async restoreQuote(id: number): Promise<Quote> {
    const response = await apiService.post<ApiResponse<Quote>>(`/quotes/${id}/restore`, {});
    return response.data;
  }

  async hardDeleteQuote(id: number): Promise<void> {
    await apiService.delete(`/quotes/${id}/permanent`);
  }

  /** Convierte la cotización en una orden real (descuenta stock). */
  async convertToOrder(id: number): Promise<Order> {
    const response = await apiService.post<ApiResponse<Order>>(`/quotes/${id}/convert`, {});
    return response.data;
  }
}

export const quoteService = new QuoteService();

export async function searchQuotesServer(q: string): Promise<Quote[]> {
  const response = await apiService.get<ApiResponse<Quote[]>>(`/quotes/search?q=${encodeURIComponent(q)}`);
  return response.data;
}

export async function getNextQuoteNumberServer(): Promise<string> {
  const response = await apiService.get<ApiResponse<{ nextQuoteNumber: string }>>('/quotes/next-number');
  return response.data.nextQuoteNumber;
}
