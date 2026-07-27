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
  customPrice?: number | null;
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
  customPrice?: number | null;
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

export interface TenantRequestItem {
  id: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  tenantId: number | null;
  createdAt: string;
}

export interface PlanPaymentItem {
  id: number;
  tenantId: number;
  plan: string;
  amount: number;
  reference: string | null;
  status: 'pending' | 'approved' | 'rejected';
  receiptNumber: string | null;
  rejectReason: string | null;
  receiptMime: string | null;
  createdAt: string;
  decidedAt: string | null;
  tenant: { id: number; name: string; slug: string } | null;
}

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
  getPlatformSettings: async () =>
    (await apiService.get<Wrapped<{ brebKey: string; brebHolder: string; prices: Record<string, number> }>>('/tenants/platform/settings')).data,
  updatePlatformSettings: async (payload: { brebKey?: string; brebHolder?: string; prices?: Record<string, number> }) =>
    (await apiService.put<Wrapped<{ brebKey: string; brebHolder: string; prices: Record<string, number> }>>('/tenants/platform/settings', payload)).data,
  listRequests: async () => (await apiService.get<Wrapped<TenantRequestItem[]>>('/tenants/requests')).data,
  approveRequest: async (id: number, payload: { slug: string; adminUsername: string; adminPassword: string; plan?: string; primaryColor?: string }) =>
    (await apiService.post<Wrapped<unknown>>(`/tenants/requests/${id}/approve`, payload)).data,
  rejectRequest: async (id: number) => (await apiService.post<Wrapped<unknown>>(`/tenants/requests/${id}/reject`, {})).data,
  listPayments: async () => (await apiService.get<Wrapped<PlanPaymentItem[]>>('/tenants/payments')).data,
  getPaymentReceipt: async (id: number) =>
    (await apiService.get<Wrapped<{ receiptBase64: string | null; receiptMime: string | null }>>(`/tenants/payments/${id}/receipt`)).data,
  approvePayment: async (id: number) => (await apiService.post<Wrapped<unknown>>(`/tenants/payments/${id}/approve`, {})).data,
  rejectPayment: async (id: number, reason?: string) => (await apiService.post<Wrapped<unknown>>(`/tenants/payments/${id}/reject`, { reason })).data,
};
