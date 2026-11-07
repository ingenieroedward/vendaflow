import { create } from 'zustand';
import { Tenant } from '../types/auth';
import { STORAGE_KEYS } from '../utils/constants';
import { deriveThemeColors, toChannels } from '../utils/themeColors';

interface TenantState {
  tenant: Tenant | null;
  isLoading: boolean;
  setTenant: (tenant: Tenant) => void;
  clearTenant: () => void;
  loadFromStorage: () => void;
}

function applyTheme(primaryColor: string) {
  // Canales RGB (sin #) para que funcione el modificador de opacidad de
  // Tailwind: rgb(var(--vf-primary) / 0.1). Además se derivan las variantes
  // con contraste AA (ver utils/themeColors.ts).
  const c = deriveThemeColors(primaryColor);
  if (!c) return;
  const root = document.documentElement.style;
  root.setProperty('--vf-primary', toChannels(c.base));
  root.setProperty('--vf-primary-ink', toChannels(c.ink));
  root.setProperty('--vf-primary-fill', toChannels(c.fill));
  root.setProperty('--vf-on-primary', toChannels(c.onFill));
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
