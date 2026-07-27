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

export interface TenantDetail {
  tenant: TenantSummary & { createdAt: string };
  users: Array<{ id: number; username: string; role: string; createdAt: string }>;
  ordersByMonth: Array<{ month: string; count: number; total: number }>;
  receivable: number;
}

export interface PlatformStats {
  version: string;
  jobs: Record<string, { at: string; ok: boolean; note?: string }>;
  tenantsByMonth: Array<{ month: string; count: number }>;
  ordersByMonth: Array<{ month: string; count: number; total: number }>;
}

interface Wrapped<T> { status: string; data: T }

export const tenantAdminService = {
  listAll: () => apiService.get<TenantSummary[]>('/tenants'),
  create: (data: CreateTenantPayload) => apiService.post<TenantSummary>('/tenants', data),
  update: (id: number, data: UpdateTenantPayload) => apiService.put<TenantSummary>(`/tenants/${id}`, data),
  suspend: (id: number) => apiService.put<TenantSummary>(`/tenants/${id}/suspend`, {}),
  activate: (id: number) => apiService.put<TenantSummary>(`/tenants/${id}/activate`, {}),
  impersonate: async (id: number) => (await apiService.post<Wrapped<{ token: string; slug: string; username: string }>>(`/tenants/${id}/impersonate`, {})).data,
  getDetail: async (id: number) => (await apiService.get<Wrapped<TenantDetail>>(`/tenants/${id}/detail`)).data,
  broadcast: async (payload: { tenantId?: number; onlyAdmins?: boolean; title: string; body: string }) =>
    (await apiService.post<Wrapped<{ recipients: number }>>('/tenants/broadcast', payload)).data,
  platformStats: async () => (await apiService.get<Wrapped<PlatformStats>>('/tenants/platform/stats')).data,
  exportData: (id: number) => apiService.get<unknown>(`/tenants/${id}/export`),
};
