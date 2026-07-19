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
  // Store as RGB channels so Tailwind's opacity modifier syntax works:
  // rgb(var(--vf-primary) / 0.1) → correctly transparent tint
  const hex = primaryColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
    document.documentElement.style.setProperty('--vf-primary', `${r} ${g} ${b}`);
  }
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
