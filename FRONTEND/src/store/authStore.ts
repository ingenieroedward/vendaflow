import { create } from 'zustand';
import { AuthState, LoginRequest, RegisterRequest } from '../types/auth';
import { authService } from '../services/auth';

export const useAuthStore = create<AuthState>((set) => ({
  user: authService.getCurrentUser(),
  token: authService.getToken(),
  isAuthenticated: authService.isAuthenticated(),
  isLoading: false,

  login: async (credentials: LoginRequest) => {
    set({ isLoading: true });
    try {
      const response = await authService.login(credentials);
      set({
        user: response.data.user,
        token: response.data.token,
        isAuthenticated: true,
        isLoading: false,
      });
      // Sincronizar productos en background sin bloquear el login
      import('../utils/backgroundProductSync')
        .then(({ syncAllProductsInBackground }) => syncAllProductsInBackground())
        .catch(() => {});
      // Suscribir a notificaciones push si el navegador lo soporta y hay permiso
      import('../services/pushNotifications')
        .then(({ isSubscribed, requestPermissionAndSubscribe }) => {
          if (!('PushManager' in window) || !('Notification' in window)) return;
          if (Notification.permission === 'denied') return;
          return isSubscribed().then((already) => {
            if (!already) return requestPermissionAndSubscribe();
          });
        })
        .catch(() => {});
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
    // Desuscribir de push notifications al salir
    import('../services/pushNotifications')
      .then(({ unsubscribeFromPush }) => unsubscribeFromPush())
      .catch(() => {});
    authService.logout();
    set({
      user: null,
      token: null,
      isAuthenticated: false,
    });
  },

  checkAuth: () => {
    const user = authService.getCurrentUser();
    const token = authService.getToken();
    const isAuthenticated = authService.isAuthenticated();
    
    set({ user, token, isAuthenticated });
  },
}));