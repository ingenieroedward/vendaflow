import React from 'react';
import { Building2, TrendingUp, Users, AlertTriangle, ClipboardList, Activity } from 'lucide-react';
import { TenantSummary, PlatformStats } from '../../services/tenantAdmin';
import { daysUntil } from '../../utils/adminHelpers';

interface FunnelData {
  days: number;
  landingViews: number;
  registroViews: number;
  requests: number;
  approved: number;
}

const Dashboard: React.FC<{
  tenants: TenantSummary[];
  platform: PlatformStats | null;
  funnel: FunnelData | null;
}> = ({ tenants, platform, funnel }) => {
  const expiringTenants = tenants.filter(t => t.trialEndsAt && daysUntil(t.trialEndsAt) <= 7 && t.status === 'trial');

  const activos = tenants.filter(t => t.status === 'active').length;
  const enTrial = tenants.filter(t => t.status === 'trial').length;
  const suspendidos = tenants.filter(t => t.status === 'suspended').length;
  const totalUsers = tenants.reduce((s, t) => s + (t.usage?.users ?? 0), 0);
  const totalOrdersMonth = tenants.reduce((s, t) => s + (t.usage?.ordersThisMonth ?? 0), 0);

  const kpis = [
    {
      label: 'Tenants',
      value: String(tenants.length),
      sub: `${activos} activos · ${enTrial} trial${suspendidos ? ` · ${suspendidos} susp.` : ''}`,
      icon: Building2,
      iconBg: 'bg-blue-100',
      iconCls: 'text-blue-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Órdenes este mes',
      value: String(totalOrdersMonth),
      sub: 'en toda la plataforma',
      icon: TrendingUp,
      iconBg: 'bg-green-100',
      iconCls: 'text-green-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Usuarios',
      value: String(totalUsers),
      sub: 'en todos los tenants',
      icon: Users,
      iconBg: 'bg-violet-100',
      iconCls: 'text-violet-600',
      accent: 'text-gray-900',
    },
    {
      label: 'Trials por vencer',
      value: String(expiringTenants.length),
      sub: expiringTenants.length ? 'vencen en ≤7 días' : 'ninguno próximo',
      icon: AlertTriangle,
      iconBg: expiringTenants.length ? 'bg-amber-100' : 'bg-gray-100',
      iconCls: expiringTenants.length ? 'text-amber-600' : 'text-gray-400',
      accent: expiringTenants.length ? 'text-amber-600' : 'text-gray-900',
    },
  ];

  // Ranking de actividad del mes — quién está usando la plataforma de verdad
  const topTenants = [...tenants]
    .filter(t => (t.usage?.ordersThisMonth ?? 0) > 0)
    .sort((a, b) => (b.usage?.ordersThisMonth ?? 0) - (a.usage?.ordersThisMonth ?? 0))
    .slice(0, 5);
  const maxOrders = topTenants[0]?.usage?.ordersThisMonth ?? 1;

  return (
    <>
      {/* KPIs de la plataforma */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map(k => (
          <div key={k.label} className="bg-white rounded-xl p-4 sm:p-5 shadow-sm border border-gray-200">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${k.iconBg}`}>
              <k.icon className={`w-5 h-5 ${k.iconCls}`} />
            </div>
            <p className={`text-2xl font-bold leading-none ${k.accent}`}>{k.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1.5">{k.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Actividad del mes por tenant */}
      {topTenants.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <ClipboardList className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Actividad del mes</h3>
            <span className="text-xs text-gray-400">órdenes por tenant</span>
          </div>
          <div className="space-y-3">
            {topTenants.map(t => {
              const orders = t.usage?.ordersThisMonth ?? 0;
              return (
                <div key={t.id} className="flex items-center gap-3">
                  <div className="w-36 sm:w-44 flex items-center gap-2 flex-shrink-0 min-w-0">
                    {t.primaryColor && (
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0 ring-1 ring-black/10"
                        style={{ backgroundColor: t.primaryColor }}
                      />
                    )}
                    <span className="text-xs font-medium text-gray-700 truncate">{t.name}</span>
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${Math.max(6, (orders / maxOrders) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-gray-600 w-8 text-right flex-shrink-0">{orders}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Crecimiento y salud del sistema */}
      {platform && (
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Crecimiento</h3>
              <span className="text-xs text-gray-400">últimos 6 meses</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Órdenes por mes (plataforma)</p>
                <div className="flex items-end gap-1.5 h-24">
                  {platform.ordersByMonth.map(m => {
                    const max = Math.max(...platform.ordersByMonth.map(x => x.count), 1);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} órdenes`}>
                        <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                        <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                        <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Tenants nuevos por mes</p>
                <div className="flex items-end gap-1.5 h-24">
                  {platform.tenantsByMonth.length === 0 ? (
                    <p className="text-xs text-gray-400 self-center">Sin registros en el período</p>
                  ) : platform.tenantsByMonth.map(m => {
                    const max = Math.max(...platform.tenantsByMonth.map(x => x.count), 1);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} tenants`}>
                        <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                        <div className="w-full bg-violet-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                        <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Sistema</h3>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              Versión desplegada: <span className="font-mono font-semibold text-gray-800">{platform.version}</span>
            </p>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Jobs diarios</p>
            <div className="space-y-1.5">
              {Object.keys(platform.jobs).length === 0 && (
                <p className="text-xs text-gray-400">Aún sin corridas (el backend arrancó hace poco)</p>
              )}
              {Object.entries(platform.jobs).map(([name, j]) => (
                <div key={name} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{name}</span>
                  <span className={`flex items-center gap-1 font-medium ${j.ok ? 'text-green-600' : 'text-red-600'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${j.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                    {new Date(j.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Embudo comercial */}
      {funnel && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-900">Embudo comercial</h3>
            <span className="text-xs text-gray-400">últimos {funnel.days} días</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Visitas landing', value: funnel.landingViews, sub: 'merco.edwsystem.com' },
              { label: 'Abrieron registro', value: funnel.registroViews, sub: funnel.landingViews > 0 ? `${Math.round((funnel.registroViews / funnel.landingViews) * 100)}% de visitas` : '—' },
              { label: 'Solicitudes', value: funnel.requests, sub: funnel.registroViews > 0 ? `${Math.round((funnel.requests / funnel.registroViews) * 100)}% de registros` : '—' },
              { label: 'Aprobadas', value: funnel.approved, sub: funnel.requests > 0 ? `${Math.round((funnel.approved / funnel.requests) * 100)}% de solicitudes` : '—' },
            ].map((s, i) => (
              <div key={s.label} className="relative bg-gray-50 rounded-lg p-3">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs font-medium text-gray-500">{s.label}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
                {i < 3 && <span className="hidden sm:block absolute -right-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-sm">→</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial expiry alerts */}
      {expiringTenants.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-800 mb-1">
                {expiringTenants.length} trial{expiringTenants.length !== 1 ? 's' : ''} expiran pronto
              </p>
              <div className="space-y-0.5">
                {expiringTenants.map(t => {
                  const days = daysUntil(t.trialEndsAt!);
                  return (
                    <p key={t.id} className="text-xs text-amber-700">
                      <span className="font-medium">{t.name}</span>
                      {' — '}
                      {days <= 0 ? 'expiró' : days === 1 ? 'vence mañana' : `vence en ${days} días`}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Dashboard;
