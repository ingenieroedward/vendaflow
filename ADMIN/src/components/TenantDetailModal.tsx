import React from 'react';
import { X, Download, LogIn } from 'lucide-react';
import { TenantDetail, TenantSummary } from '../services/tenantAdmin';
import { PLAN_LABELS, STATUS_LABELS } from '../utils/adminHelpers';

const TenantDetailModal: React.FC<{
  detail: TenantDetail;
  onClose: () => void;
  onExport: (id: number, slug: string) => void;
  onImpersonate: (t: TenantSummary) => void;
}> = ({ detail, onClose, onExport, onImpersonate }) => {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-5 sm:p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">{detail.tenant.name}</h3>
            <p className="text-xs text-gray-400 font-mono">{detail.tenant.slug} · desde {new Date(detail.tenant.createdAt).toLocaleDateString('es-CO')}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Plan</p>
            <p className="text-sm font-semibold text-gray-800">{PLAN_LABELS[detail.tenant.plan] ?? detail.tenant.plan}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Estado</p>
            <p className="text-sm font-semibold text-gray-800">{STATUS_LABELS[detail.tenant.status] ?? detail.tenant.status}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-[11px] text-gray-400">Cartera pendiente</p>
            <p className={`text-sm font-semibold ${detail.receivable > 0 ? 'text-amber-600' : 'text-gray-800'}`}>
              {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(detail.receivable)}
            </p>
          </div>
        </div>

        <p className="text-xs font-semibold text-gray-500 mb-2">Órdenes últimos 6 meses</p>
        {detail.ordersByMonth.length === 0 ? (
          <p className="text-xs text-gray-400 mb-5">Sin órdenes en el período</p>
        ) : (
          <div className="flex items-end gap-1.5 h-24 mb-5">
            {detail.ordersByMonth.map(m => {
              const max = Math.max(...detail.ordersByMonth.map(x => x.count), 1);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1" title={`${m.count} órdenes`}>
                  <span className="text-[10px] text-gray-500 font-medium">{m.count}</span>
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(6, Math.round((m.count / max) * 52))}px` }} />
                  <span className="text-[10px] text-gray-400">{m.month.slice(5)}</span>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs font-semibold text-gray-500 mb-2">Usuarios ({detail.users.length})</p>
        <div className="border border-gray-100 rounded-lg divide-y divide-gray-100 mb-5">
          {detail.users.map(u => (
            <div key={u.id} className="flex items-center justify-between px-3 py-2">
              <span className="text-sm text-gray-800">{u.username}</span>
              <span className="text-xs text-gray-400 capitalize">{u.role} · {new Date(u.createdAt).toLocaleDateString('es-CO')}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-gray-100">
          <button
            onClick={() => onExport(detail.tenant.id, detail.tenant.slug)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Exportar datos
          </button>
          {detail.tenant.slug !== 'platform' && (
            <button
              onClick={() => onImpersonate(detail.tenant as unknown as TenantSummary)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <LogIn className="w-3.5 h-3.5" /> Entrar como admin
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TenantDetailModal;
