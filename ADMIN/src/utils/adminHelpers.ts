// Constantes y helpers compartidos entre Superadmin.tsx y los modales —
// centralizados aquí para que no queden copias divergentes en cada archivo.

// Secciones del panel — único lugar donde se declara el set válido, para que
// el shell y cualquier sección que necesite navegar (ej. la tarjeta "Para
// hoy" del Dashboard) usen siempre las mismas claves.
export type SectionKey = 'dashboard' | 'tenants' | 'bandeja' | 'finanzas' | 'auditoria' | 'configuracion';

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  basic: 'Básico',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export const STATUS_LABELS: Record<string, string> = {
  active: 'Activo',
  trial: 'Trial',
  suspended: 'Suspendido',
  cancelled: 'Cancelado',
};

export function daysUntil(dateStr: string): number {
  const ms = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function tenantAppUrl(slug: string): string {
  // Funciona desde cualquier dominio (este admin vive aparte, en admin.merco.edwsystem.com)
  const base = 'merco.edwsystem.com';
  return `https://${slug}.${base}`;
}
