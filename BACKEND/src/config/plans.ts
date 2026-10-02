// Configuración de pagos: llave Bre-B y precios de planes (COP/mes).
// Fuente de verdad: tabla platform_settings (editable desde el superadmin).
// Fallback: variables de entorno → defaults. Cache en memoria 60s.
import { PlatformSetting } from '@/modules/tenant/platform-setting.model';
import { PLAN_FEATURES, isFeatureKey, type FeatureKey } from './features';
import type { TenantPlan } from '@/modules/tenant/tenant.model';

export interface PlanConfig {
  brebKey: string;
  brebHolder: string;
  prices: Record<string, number>;
  renewalWarnDays: number; // días antes del vencimiento para avisar al tenant
  graceDays: number; // días de gracia tras vencer antes de suspender
  planFeatures: Record<TenantPlan, FeatureKey[]>; // features por plan, editable sin deploy
}

const DEFAULTS: PlanConfig = {
  brebKey: process.env['BREB_KEY'] ?? '',
  brebHolder: process.env['BREB_HOLDER'] ?? 'EDW System',
  prices: {
    basic: Number(process.env['PLAN_PRICE_BASIC'] ?? 50000),
    pro: Number(process.env['PLAN_PRICE_PRO'] ?? 100000),
    enterprise: Number(process.env['PLAN_PRICE_ENTERPRISE'] ?? 200000),
  },
  renewalWarnDays: 5,
  graceDays: 5,
  planFeatures: PLAN_FEATURES,
};

const PLANS_FOR_FEATURES: TenantPlan[] = ['trial', 'basic', 'pro', 'enterprise'];

function parseFeatureList(csv: string | undefined, fallback: FeatureKey[]): FeatureKey[] {
  if (csv === undefined) return fallback;
  return csv.split(',').map(s => s.trim()).filter(isFeatureKey);
}

let cache: { at: number; value: PlanConfig } | null = null;

export async function getPlanConfig(): Promise<PlanConfig> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const rows = await PlatformSetting.findAll({ raw: true });
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const value: PlanConfig = {
    brebKey: s['breb_key'] ?? DEFAULTS.brebKey,
    brebHolder: s['breb_holder'] ?? DEFAULTS.brebHolder,
    prices: {
      basic: Number(s['price_basic'] ?? DEFAULTS.prices['basic']),
      pro: Number(s['price_pro'] ?? DEFAULTS.prices['pro']),
      enterprise: Number(s['price_enterprise'] ?? DEFAULTS.prices['enterprise']),
    },
    renewalWarnDays: Number(s['renewal_warn_days'] ?? DEFAULTS.renewalWarnDays),
    graceDays: Number(s['grace_days'] ?? DEFAULTS.graceDays),
    planFeatures: Object.fromEntries(
      PLANS_FOR_FEATURES.map(plan => [plan, parseFeatureList(s[`features_${plan}`], DEFAULTS.planFeatures[plan])]),
    ) as Record<TenantPlan, FeatureKey[]>,
  };
  cache = { at: Date.now(), value };
  return value;
}

export async function setPlanConfig(data: { brebKey?: string; brebHolder?: string; prices?: Record<string, number>; renewalWarnDays?: number; graceDays?: number; planFeatures?: Partial<Record<TenantPlan, FeatureKey[]>> }): Promise<PlanConfig> {
  const entries: Array<[string, string]> = [];
  if (data.brebKey !== undefined) entries.push(['breb_key', data.brebKey]);
  if (data.brebHolder !== undefined) entries.push(['breb_holder', data.brebHolder]);
  for (const plan of ['basic', 'pro', 'enterprise']) {
    const v = data.prices?.[plan];
    if (v !== undefined && !Number.isNaN(Number(v))) entries.push([`price_${plan}`, String(v)]);
  }
  if (data.renewalWarnDays !== undefined && Number.isFinite(Number(data.renewalWarnDays))) entries.push(['renewal_warn_days', String(data.renewalWarnDays)]);
  if (data.graceDays !== undefined && Number.isFinite(Number(data.graceDays))) entries.push(['grace_days', String(data.graceDays)]);
  if (data.planFeatures) {
    for (const plan of PLANS_FOR_FEATURES) {
      const list = data.planFeatures[plan];
      if (list !== undefined) entries.push([`features_${plan}`, list.filter(isFeatureKey).join(',')]);
    }
  }
  for (const [key, value] of entries) {
    await PlatformSetting.upsert({ key, value });
  }
  cache = null;
  return getPlanConfig();
}
