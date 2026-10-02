import { useTenantStore } from '../store/tenantStore';

/**
 * ¿El tenant actual tiene esta feature del plan? (ej. 'pos', 'custom_branding').
 * El backend es la fuente de verdad real (requireFeature en las rutas) —
 * esto es solo para la UI: mostrar/ocultar y evitar una llamada que sabemos
 * que va a fallar con 403.
 */
export function useFeature(feature: string): boolean {
  const tenant = useTenantStore(s => s.tenant);
  return Boolean(tenant?.features?.includes(feature));
}
