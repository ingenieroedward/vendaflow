import { apiService } from './api';

export interface TenantSummary {
  id: number;
  slug: string;
  name: string;
  plan: string;
  status: string;
  primaryColor: string | null;
  logoUrl: string | null;
  trialEndsAt: string | null;
  maxUsers: number;
  maxProducts: number;
  maxOrdersPerMonth: number;
  createdAt: string;
  updatedAt: string;
  usage?: {
    users: number;
    products: number;
    ordersThisMonth: number;
  };
}

export interface CreateTenantPayload {
  slug: string;
  name: string;
  plan?: 'trial' | 'basic' | 'pro' | 'enterprise';
  adminUsername: string;
  adminPassword: string;
  primaryColor?: string;
}

export interface UpdateTenantPayload {
  name?: string;
  plan?: 'trial' | 'basic' | 'pro' | 'enterprise';
  trialEndsAt?: string | null;
  maxUsers?: number;
  maxProducts?: number;
  maxOrdersPerMonth?: number;
}

export const tenantAdminService = {
  listAll: () => apiService.get<TenantSummary[]>('/tenants'),
  create: (data: CreateTenantPayload) => apiService.post<TenantSummary>('/tenants', data),
  update: (id: number, data: UpdateTenantPayload) => apiService.put<TenantSummary>(`/tenants/${id}`, data),
  suspend: (id: number) => apiService.put<TenantSummary>(`/tenants/${id}/suspend`, {}),
  activate: (id: number) => apiService.put<TenantSummary>(`/tenants/${id}/activate`, {}),
};
