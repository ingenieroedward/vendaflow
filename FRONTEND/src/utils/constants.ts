//export const API_BASE_URL = 'https://api-jjlm.edwsystem.com/api';
export const API_BASE_URL = 'http://localhost:3000/api';

export const APP_CONFIG = {
  name: 'JJLM Sistema',
  version: '1.0.0',
  description: 'Sistema de Gestión de Productos y Precios',
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
  AUTH_TOKEN: 'jjlm_token',
  USER_DATA: 'jjlm_user',
} as const;

export const DEFAULT_PAGINATION = {
  page: 1,
  limit: 10,
};

export const DEBOUNCE_DELAY = 300;