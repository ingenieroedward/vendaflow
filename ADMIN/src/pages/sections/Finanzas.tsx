import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FinanceData, TenantSummary } from '../../services/tenantAdmin';
import { PLAN_LABELS } from '../../utils/adminHelpers';

const Finanzas: React.FC<{
  finance: FinanceData | null;
  tenants: TenantSummary[];
  onPayTenant: (t: TenantSummary) => void;
  /** true si la carga de finance falló — antes esto se quedaba mostrando
   * "Cargando finanzas…" para siempre, sin ningún indicio del error */
  failed: boolean;
  onReload: () => Promise<void>;
}> = ({ finance, tenants, onPayTenant, failed, onReload }) => {
  if (!finance) {
    if (failed) {
      return (
        <div className="text-center py-16">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-gray-500 mb-3">No se pudieron cargar las finanzas</p>
          <button
            onClick={onReload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      );
    }
    return <div className="text-center py-16 text-gray-400 text-sm">Cargando finanzas…</div>;
  }

  return (
    <>
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">MRR</p>
          <p className="text-2xl font-bold text-gray-900">${finance.mrr.toLocaleString('es-CO')}</p>
          <p className="text-[11px] text-gray-400">{finance.activePaying} tenant(s) pagando</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Cobrado este mes</p>
          {(() => {
            const now = new Date().toISOString().slice(0, 7);
            const cur = finance.revenueByMonth.find(r => r.month === now)?.total ?? 0;
            const prevKey = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);
            const prev = finance.revenueByMonth.find(r => r.month === prevKey)?.total ?? 0;
            const delta = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
            return (<>
              <p className="text-2xl font-bold text-gray-900">${cur.toLocaleString('es-CO')}</p>
              <p className={`text-[11px] ${delta == null ? 'text-gray-400' : delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {delta == null ? 'sin mes anterior' : `${delta >= 0 ? '+' : ''}${delta}% vs mes anterior`}
              </p>
            </>);
          })()}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Morosos</p>
          <p className={`text-2xl font-bold ${finance.overdue.length ? 'text-red-600' : 'text-gray-900'}`}>{finance.overdue.length}</p>
          <p className="text-[11px] text-gray-400">${finance.overdue.reduce((s, t) => s + t.amount, 0).toLocaleString('es-CO')} en riesgo</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-xs font-medium text-gray-500">Vencen en 30 días</p>
          <p className="text-2xl font-bold text-gray-900">{finance.upcoming.length}</p>
          <p className="text-[11px] text-gray-400">${finance.upcoming.reduce((s, t) => s + t.amount, 0).toLocaleString('es-CO')} por cobrar</p>
        </div>
      </div>

      {/* Ingresos por mes */}
      {finance.revenueByMonth.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Ingresos por mes</h3>
          <div className="flex items-end gap-3 h-28">
            {finance.revenueByMonth.map(r => {
              const max = Math.max(...finance.revenueByMonth.map(x => x.total), 1);
              return (
                <div key={r.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">${Math.round(r.total / 1000)}k</span>
                  <div className="w-full bg-emerald-500 rounded-t" style={{ height: `${Math.max(4, Math.round((r.total / max) * 80))}px` }} />
                  <span className="text-[10px] text-gray-400">{r.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Morosos */}
      {finance.overdue.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-200 mb-6 overflow-hidden">
          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
            <h3 className="text-sm font-semibold text-red-800">Morosos — cobrar ya (gracia: {finance.graceDays} días)</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {finance.overdue.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}
                    {t.suspended && <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">suspendido</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">venció {t.paidUntil ?? '—'}{t.daysOverdue != null ? ` (hace ${t.daysOverdue}d)` : ''}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${t.amount.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {(() => {
                      const full = tenants.find(x => x.id === t.id);
                      const phone = full?.contactPhone?.replace(/\D/g, '');
                      return (<>
                        {phone && (
                          <a href={`https://wa.me/${phone}?text=${encodeURIComponent(`Hola${full?.contactName ? ` ${full.contactName}` : ''}, te escribo de Merco: el plan de ${t.name} venció el ${t.paidUntil}. ¿Te ayudo con la renovación? Valor: $${t.amount.toLocaleString('es-CO')}`)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="mr-1.5 px-2.5 py-1 text-xs font-semibold text-green-700 border border-green-300 rounded-lg hover:bg-green-50">
                            WhatsApp
                          </a>
                        )}
                        <button
                          onClick={() => { if (full) onPayTenant(full); }}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                        >
                          Registrar pago
                        </button>
                      </>);
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Próximos vencimientos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Próximos vencimientos (30 días)</h3>
        </div>
        {finance.upcoming.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400 text-center">Nada vence en los próximos 30 días</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {finance.upcoming.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    vence {t.paidUntil} {t.daysLeft != null && <span className={t.daysLeft <= finance.renewalWarnDays ? 'text-amber-600 font-semibold' : ''}>({t.daysLeft}d)</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${t.amount.toLocaleString('es-CO')}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => { const full = tenants.find(x => x.id === t.id); if (full) onPayTenant(full); }}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50"
                    >
                      Registrar pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Sin fecha de pago */}
      {finance.noPaidUntil.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 mb-6 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
            <h3 className="text-sm font-semibold text-amber-800">Sin fecha de pago — registra su último pago para que entren al ciclo</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {finance.noPaidUntil.map(t => (
                <tr key={t.id}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{PLAN_LABELS[t.plan] ?? t.plan} · ${t.amount.toLocaleString('es-CO')}/mes</td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => { const full = tenants.find(x => x.id === t.id); if (full) onPayTenant(full); }}
                      className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                    >
                      Registrar pago
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Histórico por tenant */}
      {finance.ltv.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Histórico cobrado por tenant</h3>
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {finance.ltv.map(r => (
                <tr key={r.tenantId}>
                  <td className="px-4 py-2.5 font-medium text-gray-900">{r.name}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{r.payments} pago(s) · cliente desde {new Date(r.since).toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-gray-900">${r.totalPaid.toLocaleString('es-CO')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

export default Finanzas;
