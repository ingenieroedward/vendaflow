import { apiService } from './api';
import { Tenant } from '../types/auth';

export async function getMyTenant(): Promise<Tenant | null> {
  try {
    return await apiService.get<Tenant>('/tenants/me');
  } catch {
    return null;
  }
}

export async function updateMyTheme(data: {
  name?: string;
  primaryColor?: string;
  logoUrl?: string | null;
  nit?: string | null;
  address?: string | null;
  city?: string | null;
  contactEmail?: string | null;
}): Promise<void> {
  await apiService.put<unknown>('/tenants/me/theme', data);
}

interface TenantResponse {
  id: number;
  slug: string;
  name: string;
  status: string;
  logoUrl: string | null;
  primaryColor: string;
}

export async function fetchTenantBySlug(slug: string): Promise<Tenant | null> {
  try {
    const data = await apiService.get<TenantResponse>(`/tenants/slug/${slug}`);
    return data;
  } catch {
    return null;
  }
}

// Detects the tenant slug from the current URL.
// - subdomain: acme.merco.edwsystem.com → 'acme'
// - query param ?tenant=acme (for local dev: localhost?tenant=acme)
// - env var VITE_TENANT_SLUG (for staging deploys)
export function detectTenantSlug(): string | null {
  // 1. Env override (staging / CI)
  const envSlug = import.meta.env.VITE_TENANT_SLUG as string | undefined;
  if (envSlug) return envSlug;

  // 2. Query param (?tenant=acme) — useful for local dev
  const params = new URLSearchParams(window.location.search);
  const qSlug = params.get('tenant');
  if (qSlug) return qSlug;

  // 3. Subdomain detection
  const hostname = window.location.hostname;
  const parts = hostname.split('.');
  const reserved = new Set(['www', 'app', 'api', 'localhost', 'merco', 'edwsystem']);
  if (parts.length >= 2 && !reserved.has(parts[0]!)) {
    return parts[0] ?? null;
  }

  return null;
}
