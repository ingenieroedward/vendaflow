import { create } from 'zustand';
import { Tenant } from '../types/auth';
import { STORAGE_KEYS } from '../utils/constants';

interface TenantState {
  tenant: Tenant | null;
  isLoading: boolean;
  setTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  loadFromStorage: () => void;
}

function applyTheme(primaryColor: string) {
  document.documentElement.style.setProperty('--vf-primary', primaryColor);
  // Derive a lighter shade for hover/bg states
  document.documentElement.style.setProperty('--vf-primary-10', primaryColor + '1a');
}

export const useTenantStore = create<TenantState>((set) => ({
  tenant: null,
  isLoading: false,

  setTenant: (tenant: Tenant) => {
    localStorage.setItem(STORAGE_KEYS.TENANT_DATA, JSON.stringify(tenant));
    if (tenant.primaryColor) applyTheme(tenant.primaryColor);
    set({ tenant });
  },

  clearTenant: () => {
    localStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
    set({ tenant: null });
  },

  loadFromStorage: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.TENANT_DATA);
      if (!raw) return;
      const tenant: Tenant = JSON.parse(raw);
      if (tenant.primaryColor) applyTheme(tenant.primaryColor);
      set({ tenant });
    } catch {
      localStorage.removeItem(STORAGE_KEYS.TENANT_DATA);
    }
  },
}));
