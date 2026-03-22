import { apiService } from './api';
import { User, CreateUserRequest, UpdateUserRequest, UsersResponse } from '../types/auth';

export class UsersService {
  async getUsers(page: number = 1, limit: number = 10): Promise<UsersResponse> {
    const response = await apiService.get<{ 
      status: string; 
      data: User[]; 
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      }
    }>(`/users?page=${page}&limit=${limit}`);
    
    return {
      data: response.data,
      pagination: response.pagination,
    };
  }

  async getUserById(id: number): Promise<User> {
    const response = await apiService.get<{ status: string; data: User }>(`/users/${id}`);
    return response.data;
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    const response = await apiService.post<{ status: string; data: User }>('/users', userData);
    return response.data;
  }

  async updateUser(id: number, userData: UpdateUserRequest): Promise<User> {
    const response = await apiService.put<{ status: string; data: User }>(`/users/${id}`, userData);
    return response.data;
  }

  async deleteUser(id: number, transferTo?: number): Promise<void> {
    await apiService.delete(`/users/${id}`, transferTo ? { transferTo } : undefined);
  }

  async restoreUser(id: number): Promise<void> {
    await apiService.get(`/users/${id}/restore`);
  }

  async changePassword(id: number, currentPassword: string, newPassword: string): Promise<void> {
    await apiService.put(`/users/${id}/password`, {
      currentPassword,
      newPassword,
    });
  }
}

export const usersService = new UsersService(); 