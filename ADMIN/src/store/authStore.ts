import { create } from 'zustand';
import { STORAGE_KEYS } from '../utils/constants';

export interface AdminUser {
  id: number;
  username: string;
  role: string;
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  logout: () => void;
}

function loadUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

function hasToken(): boolean {
  return Boolean(localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN));
}

// Store mínimo del superadmin — sin IndexedDB ni sincronización offline
// (eso es maquinaria de la app de tenants que aquí no aplica). El login
// real vive en AdminLogin (escribe directo a localStorage + recarga);
// este store solo expone el estado ya persistido y el logout.
export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  isAuthenticated: hasToken(),
  logout: () => {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);
    set({ user: null, isAuthenticated: false });
  },
}));
