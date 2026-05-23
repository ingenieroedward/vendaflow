import { apiService } from './api';
import { LoginRequest, RegisterRequest, LoginResponse, User } from '../types/auth';
import { STORAGE_KEYS } from '../utils/constants';

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/login', credentials); 
    // Store token and user data
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    
    return response;
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/register', data);
    
    // Store token and user data
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    
    return response;
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
  }

  getCurrentUser(): User | null {
    const userData = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!userData) return null;
    try {
      return JSON.parse(userData);
    } catch {
      localStorage.removeItem(STORAGE_KEYS.USER_DATA);
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    return !!(token && user);
  }
}

export const authService = new AuthService();