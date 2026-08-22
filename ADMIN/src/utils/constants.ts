const PRODUCTION_API = 'https://api.merco.edwsystem.com/api';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? PRODUCTION_API;

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'vf_admin_token',
  USER_DATA: 'vf_admin_user',
} as const;
