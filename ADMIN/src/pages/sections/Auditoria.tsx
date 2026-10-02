import React from 'react';
import { ScrollText, AlertTriangle, RefreshCw } from 'lucide-react';
import { AuditLogItem } from '../../services/tenantAdmin';

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  impersonate: { label: 'Impersonar', cls: 'bg-purple-100 text-purple-700' },
  payment_register: { label: 'Pago registrado', cls: 'bg-emerald-100 text-emerald-700' },
  payment_approve: { label: 'Pago aprobado', cls: 'bg-green-100 text-green-700' },
  payment_reject: { label: 'Pago rechazado', cls: 'bg-red-100 text-red-700' },
  tenant_suspend: { label: 'Suspensión', cls: 'bg-red-100 text-red-700' },
  tenant_activate: { label: 'Reactivación', cls: 'bg-green-100 text-green-700' },
  tenant_create: { label: 'Tenant creado', cls: 'bg-blue-100 text-blue-700' },
  tenant_update: { label: 'Tenant editado', cls: 'bg-gray-100 text-gray-600' },
  tenant_cancel: { label: 'Cancelación', cls: 'bg-orange-100 text-orange-700' },
  tenant_purge: { label: 'Purga de datos', cls: 'bg-red-200 text-red-800' },
  tenant_export: { label: 'Export', cls: 'bg-gray-100 text-gray-600' },
  request_approve: { label: 'Solicitud aprobada', cls: 'bg-blue-100 text-blue-700' },
  request_reject: { label: 'Solicitud rechazada', cls: 'bg-gray-100 text-gray-600' },
  broadcast: { label: 'Anuncio push', cls: 'bg-indigo-100 text-indigo-700' },
};

const Auditoria: React.FC<{
  auditLogs: AuditLogItem[];
  /** true si la carga falló — antes "sin logs" y "no cargó" se veían igual */
  failed: boolean;
  onReload: () => Promise<void>;
}> = ({ auditLogs, failed, onReload }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900">Auditoría de la plataforma</h3>
        <span className="text-xs text-gray-400">últimas {auditLogs.length} acciones</span>
      </div>
      {failed ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400" />
          <p className="text-sm text-gray-500 mb-3">No se pudo cargar la auditoría</p>
          <button
            onClick={onReload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reintentar
          </button>
        </div>
      ) : auditLogs.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-12">Aún no hay acciones registradas</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Tenant</th>
                <th className="px-4 py-2.5 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {auditLogs.map(a => {
                const meta = ACTION_LABELS[a.action] ?? { label: a.action, cls: 'bg-gray-100 text-gray-600' };
                let detail = '';
                try { detail = a.meta ? Object.entries(JSON.parse(a.meta)).map(([k, v]) => `${k}: ${v}`).join(' · ') : ''; } catch { detail = a.meta ?? ''; }
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{new Date(a.createdAt).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>{meta.label}</span></td>
                    <td className="px-4 py-2.5 text-gray-700">{a.tenantSlug ?? (a.tenantId ? `#${a.tenantId}` : '—')}</td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 max-w-[22rem] truncate">{detail}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Auditoria;
