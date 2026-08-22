import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import { API_BASE_URL, STORAGE_KEYS } from '../utils/constants';

// Error real (instanceof Error) para que los stores muestren el mensaje del
// backend — antes el interceptor rechazaba con un objeto literal y TODOS los
// mensajes ("cuota del plan", "cliente no existe", …) caían al genérico
export class ApiRequestError extends Error {
  status: number;
  code?: string | undefined;
  /** true si el server no respondió (red caída, timeout) o está caído (502/503/504) */
  isNetworkError: boolean;

  constructor(message: string, status: number, code: string | undefined, isNetworkError: boolean) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.isNetworkError = isNetworkError;
  }
}

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError) => {
        const status = error.response?.status ?? 0;
        const serverDown = !error.response || status === 502 || status === 503 || status === 504;
        const message = serverDown
          ? 'Sin conexión con el servidor'
          : (error.response?.data as { message?: string })?.message || error.message || 'Error desconocido';
        const apiError = new ApiRequestError(message, status || 500, error.code, serverDown);

        // Auto logout on 401 — pero NO en el login (contraseña errada no debe
        // recargar la página y tragarse la notificación de error)
        const url = error.config?.url ?? '';
        if (status === 401 && !url.includes('/auth/login') && window.location.pathname !== '/login') {
          import('../store/authStore').then(({ useAuthStore }) => {
            useAuthStore.getState().logout();
          });
          window.location.href = '/login';
        }

        return Promise.reject(apiError);
      }
    );
  }

  async get<T>(url: string, params?: unknown): Promise<T> {
    const response = await this.api.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.api.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.api.put<T>(url, data);
    return response.data;
  }

  async patch<T>(url: string, data?: unknown): Promise<T> {
    const response = await this.api.patch<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const response = await this.api.delete<T>(url, { params });
    return response.data;
  }
}

export const apiService = new ApiService();