import type { TenantPlan } from '@/modules/tenant/tenant.model';

// Catálogo de features vendibles por plan (independiente de los límites
// numéricos de PLAN_LIMITS en tenant.service.ts). Agregar una feature nueva
// aquí y en PLAN_FEATURES — no requiere tocar nada más para que exista.
export const ALL_FEATURES = ['pos', 'custom_branding', 'multi_warehouse', 'api_access', 'quotes'] as const;
export type FeatureKey = typeof ALL_FEATURES[number];

export function isFeatureKey(v: unknown): v is FeatureKey {
  return typeof v === 'string' && (ALL_FEATURES as readonly string[]).includes(v);
}

// Defaults por plan. trial incluye 'pos' y 'quotes' para que el prospecto las
// pruebe durante los 14 días — son las features más vendibles, mejor mostrarlas.
export const PLAN_FEATURES: Record<TenantPlan, FeatureKey[]> = {
  trial: ['pos', 'quotes'],
  basic: [],
  pro: ['pos', 'custom_branding', 'quotes'],
  enterprise: ['pos', 'custom_branding', 'multi_warehouse', 'api_access', 'quotes'],
};

/**
 * Resuelve las features efectivas de un tenant: si tiene `customFeatures`
 * seteado (override negociado caso a caso, igual patrón que customPrice),
 * ese array manda completo; si no, se usa el default de su plan.
 *
 * `planFeatures` es inyectable (default: PLAN_FEATURES estático) porque el
 * superadmin puede redefinir qué trae cada plan desde platform_settings sin
 * deploy — ver config/plans.ts. Los callers async pasan ese valor cargado;
 * los tests usan el default para no depender de la base de datos.
 */
export function resolveFeatures(
  tenant: { plan: TenantPlan; customFeatures?: string | null },
  planFeatures: Record<TenantPlan, FeatureKey[]> = PLAN_FEATURES,
): Set<FeatureKey> {
  if (tenant.customFeatures) {
    try {
      const parsed = JSON.parse(tenant.customFeatures);
      if (Array.isArray(parsed)) return new Set(parsed.filter(isFeatureKey));
    } catch {
      // JSON corrupto — cae al default del plan en vez de romper
    }
  }
  return new Set(planFeatures[tenant.plan] ?? []);
}
