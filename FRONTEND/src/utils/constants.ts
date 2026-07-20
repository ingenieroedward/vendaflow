const PRODUCTION_API = 'https://api.merco.edwsystem.com/api';

// En contexto nativo (APK Capacitor) siempre usar la URL de producción.
// El WebView del APK no tiene proxy nginx, así que localhost no funciona.
const isNative = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' ||
   (window.location.protocol === 'https:' && window.location.hostname === 'localhost' && !import.meta.env.DEV));

export const API_BASE_URL = isNative
  ? PRODUCTION_API
  : (import.meta.env.VITE_API_BASE_URL ?? PRODUCTION_API);

export const APP_CONFIG = {
  name: 'Merco',
  version: '1.0.0',
  description: 'Sistema de Gestión de Ventas',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PRODUCTS: '/products',
  PRODUCT_DETAIL: '/products/:id',
  SUPPLIERS: '/suppliers',
  PRICES: '/prices',
  CATEGORIES: '/categories',
  PROFILE: '/profile',
  ADMIN: '/admin',
} as const;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'vf_token',
  USER_DATA: 'vf_user',
  TENANT_DATA: 'vf_tenant',
} as const;

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
};

export const DEBOUNCE_DELAY = 300;