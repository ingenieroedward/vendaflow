import { apiService } from './api';
import { LoginRequest, RegisterRequest, LoginResponse, User, Tenant } from '../types/auth';
import { STORAGE_KEYS } from '../utils/constants';

export class AuthService {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/login', credentials);
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    if (response.data.tenant) {
      localStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(response.data.tenant));
    }
    return response;
  }

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await apiService.post<LoginResponse>('/auth/register', data);
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, response.data.token);
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(response.data.user));
    return response;
  }

  getTenant(): Tenant | null {
    const raw = localStorage.getItem(STORAGE_KEYS.TENANT_DATA);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
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
    const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    if (!token) return null;
    // Evita enviar un JWT vencido — limpia antes de cualquier llamada API
    if (this.isTokenExpired(token)) {
      this.logout();
      return null;
    }
    return token;
  }

  isAuthenticated(): boolean {
    const token = this.getToken(); // ya valida expiración
    const user = this.getCurrentUser();
    return !!(token && user);
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // exp está en segundos, Date.now() en ms
      return payload.exp * 1000 < Date.now();
    } catch {
      return true; // token malformado → tratar como vencido
    }
  }
}

export const authService = new AuthService();