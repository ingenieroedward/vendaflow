import { create } from 'zustand';
import { AuthState, LoginRequest, RegisterRequest, User } from '../types/auth';
import { authService } from '../services/auth';
import { db } from '../database/LocalDatabase';
import { useTenantStore } from './tenantStore';
import { STORAGE_KEYS } from '../utils/constants';

export const useAuthStore = create<AuthState>((set) => ({
  user: authService.getCurrentUser(),
  token: authService.getToken(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);
      const user = response.data.user;
      // Aislar datos locales entre tenants: si en este dispositivo la última
      // sesión fue de otro tenant, limpiar IndexedDB antes de usarla (evita que
      // un usuario vea productos/clientes/órdenes del tenant anterior)
      const tenantKey = String(response.data.tenant?.id ?? response.data.tenant?.slug ?? '');
      const prevTenantKey = localStorage.getItem('vf_last_tenant');
      if (tenantKey && prevTenantKey && prevTenantKey !== tenantKey) {
        await db.resetDatabase().catch(() => {});
      }
      if (tenantKey) localStorage.setItem('vf_last_tenant', tenantKey);
      set({ user, token: response.data.token, isAuthenticated: true, isLoading: false });
      if (response.data.tenant) {
        useTenantStore.getState().setTenant(response.data.tenant);
      }
      cacheUserLocally(user).catch(() => {});
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (data: RegisterRequest) => {
    set({ isLoading: true });
    try {
      const response = await authService.register(data);
      set({
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    authService.logout();
    useTenantStore.getState().clearTenant();
    set({ user: null, token: null, isAuthenticated: false });
  },

  checkAuth: () => {
    const user = authService.getCurrentUser();
    const token = authService.getToken();
    const isAuthenticated = authService.isAuthenticated();
    set({ user, token, isAuthenticated });
    if (user) cacheUserLocally(user).catch(() => {});
  },

  setUser: (user: User) => {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(user));
    set({ user });
    cacheUserLocally(user).catch(() => {});
  },
}));

async function cacheUserLocally(user: { id: number; username: string; role: string }) {
  const userData = {
    serverId: user.id,
    username: user.username,
    role: user.role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    _syncStatus: 'SYNCED' as const,
    _version: 1,
    _lastModifiedAt: Date.now(),
  };
  const existing = await db.users.where('serverId').equals(user.id).first();
  if (existing?.id) {
    await db.users.update(existing.id, userData);
  } else {
    await db.users.add(userData as any);
  }
}